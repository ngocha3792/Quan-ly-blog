import { Injectable, ForbiddenException } from '@nestjs/common';
import {
  PrismaService,
  UsersService,
  UserNotFoundException,
  EmailAlreadyExistsException,
  UsernameAlreadyExistsException,
  SelfActionNotAllowedException,
  GetUsersDto,
  PaginationParams,
  PaginatedResult,
  BcryptUtil,
} from '@app/core';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { AdminUserEntity } from '../entities';
import {
  AdminUpdateUserDto,
  ChangeUserRoleDto,
  CreateModeratorDto,
  LockUserDto,
} from '../dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly bcryptUtil: BcryptUtil,
  ) { }

  /**
   * Lấy danh sách tất cả tài khoản (tận dụng lại UsersService từ @app/core để tránh lặp code).
   */
  async findAll(
    getUsersDto: GetUsersDto,
    paginationParams: PaginationParams,
  ): Promise<PaginatedResult<AdminUserEntity>> {
    const result = await this.usersService.findAll(
      getUsersDto,
      paginationParams,
    );

    return {
      items: result.items.map((user) => new AdminUserEntity(user)),
      meta: result.meta,
    };
  }

  /**
   * Lấy chi tiết một người dùng bao gồm danh sách các bài viết đã đăng.
   */
  async findOne(id: number): Promise<AdminUserEntity> {
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: {
        posts: {
          include: {
            postCategories: {
              include: {
                category: true,
              },
            },
            postTags: {
              include: {
                tag: true,
              },
            },
            _count: {
              select: {
                postLikes: true,
                comments: {
                  where: {
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UserNotFoundException(id.toString());
    }

    return new AdminUserEntity(user);
  }

  /**
   * Cập nhật thông tin user bởi Admin.
   *
   * role/status không xử lý tại đây để tránh bypass
   * business rule ở changeRole(), lockUser(), unlockUser().
   *
   * Nếu password thay đổi:
   * - hash password mới
   * - update password
   * - revoke tất cả session
   *
   * Update password + revoke session chạy cùng transaction.
   */
  async update(
    userId: number,
    updateUserDto: AdminUpdateUserDto,
  ): Promise<AdminUserEntity> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    const { password, bio, avatarUrl } = updateUserDto;

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (bio !== undefined) {
      dataToUpdate.bio = bio;
    }

    if (avatarUrl !== undefined) {
      dataToUpdate.avatarUrl = avatarUrl;
    }

    // Không đổi password
    // => không cần revoke session
    if (password === undefined) {
      const updatedUser = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: dataToUpdate,
      });

      return new AdminUserEntity(updatedUser);
    }

    // Admin reset password user
    const passwordHash = await this.bcryptUtil.hashPassword(password);

    dataToUpdate.passwordHash = passwordHash;

    const revokedAt = new Date();

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: userId,
        },
        data: dataToUpdate,
      }),

      this.prisma.userSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      }),
    ]);

    return new AdminUserEntity(updatedUser);
  }

  /**
   * Khóa tài khoản người dùng và thu hồi toàn bộ session đăng nhập.
   */
  async lockUser(
    userId: number,
    adminId: number,
    lockUserDto: LockUserDto,
  ): Promise<AdminUserEntity> {
    if (userId === adminId) {
      throw new SelfActionNotAllowedException('khóa tài khoản');
    }

    const user = await this.usersService.findById(userId);
    if (!user) throw new UserNotFoundException(userId.toString());

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Không thể khóa tài khoản Super Admin.');
    }

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.LOCKED,
          lockedAt: new Date(),
          lockedById: adminId,
          lockReason: lockUserDto.reason,
        },
      }),
      // Thu hồi tất cả phiên đăng nhập hiện tại
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return new AdminUserEntity(updatedUser);
  }

  /**
   * Mở khóa tài khoản người dùng.
   */
  async unlockUser(userId: number, adminId: number): Promise<AdminUserEntity> {
    if (userId === adminId) {
      throw new SelfActionNotAllowedException('mở khóa tài khoản');
    }

    const user = await this.usersService.findById(userId);
    if (!user) throw new UserNotFoundException(userId.toString());

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Không thể thao tác trên tài khoản Super Admin.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        lockedAt: null,
        lockedById: null,
        lockReason: null,
      },
    });

    return new AdminUserEntity(updatedUser);
  }

  /**
   * Thay đổi vai trò (thêm quyền / tước quyền) của người dùng và thu hồi phiên đăng nhập cũ, tránh refreshToken dùng role cũ
   */
  async changeRole(
    userId: number,
    adminId: number,
    changeUserRoleDto: ChangeUserRoleDto,
  ): Promise<AdminUserEntity> {
    if (userId === adminId) {
      throw new SelfActionNotAllowedException('thay đổi vai trò');
    }

    const user = await this.usersService.findById(userId);
    if (!user) throw new UserNotFoundException(userId.toString());

    if (user.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      });
      if (superAdminCount <= 1 && changeUserRoleDto.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Không thể thay đổi vai trò của Super Admin cuối cùng trong hệ thống.',
        );
      }
      throw new ForbiddenException(
        'Không thể thay đổi vai trò của tài khoản Super Admin khác.',
      );
    }

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          role: changeUserRoleDto.role,
        },
      }),
      // Thu hồi tất cả các phiên đăng nhập hiện tại để buộc người dùng cấp lại token phù hợp vai trò mới
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return new AdminUserEntity(updatedUser);
  }

  /**
   * Xóa tài khoản người dùng bởi Admin.
   */
  async removeUser(userId: number, adminId: number) {
    if (userId === adminId) {
      throw new SelfActionNotAllowedException('xóa tài khoản');
    }

    const user = await this.usersService.findById(userId);
    if (!user) throw new UserNotFoundException(userId.toString());

    if (user.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      });
      if (superAdminCount <= 1) {
        throw new ForbiddenException(
          'Không thể xóa Super Admin cuối cùng trong hệ thống.',
        );
      }
      throw new ForbiddenException('Không thể xóa tài khoản Super Admin khác.');
    }

    return this.usersService.remove(userId);
  }

  /**
   * Tạo tài khoản Moderator trực tiếp.
   */
  async createModerator(
    createModeratorDto: CreateModeratorDto,
  ): Promise<AdminUserEntity> {
    const { username, email, password, bio, avatarUrl } = createModeratorDto;

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      if (existingUser.email === email)
        throw new EmailAlreadyExistsException(email);
      if (existingUser.username === username)
        throw new UsernameAlreadyExistsException(username);
    }

    const passwordHash = await this.bcryptUtil.hashPassword(password);

    const newModerator = await this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: UserRole.CONTENT_MODERATOR,
        status: UserStatus.ACTIVE,
        bio,
        avatarUrl,
      },
    });

    return new AdminUserEntity(newModerator);
  }
}
