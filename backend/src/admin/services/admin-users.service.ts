import { Injectable } from '@nestjs/common';
import {
  PrismaService,
  UsersService,
  UserNotFoundException,
  EmailAlreadyExistsException,
  UsernameAlreadyExistsException,
  GetUsersDto,
  PaginationParams,
  PaginatedResult,
  BcryptUtil,
} from '@app/core';
import { UserStatus, UserRole } from '@prisma/client';
import { AdminUserEntity } from '../entities';
import { LockUserDto, ChangeUserRoleDto, CreateModeratorDto } from '../dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly bcryptUtil: BcryptUtil,
  ) {}

  /**
   * Lấy danh sách tất cả tài khoản (tận dụng lại UsersService từ @app/core để tránh lặp code).
   */
  async findAll(
    getUsersDto: GetUsersDto,
    paginationParams: PaginationParams,
  ): Promise<PaginatedResult<AdminUserEntity>> {
    const result = await this.usersService.findAll(getUsersDto, paginationParams);

    return {
      items: result.items.map((user) => new AdminUserEntity(user)),
      meta: result.meta,
    };
  }

  /**
   * Xem chi tiết thông tin 1 tài khoản bao gồm tất cả các bài viết của blogowner đó
   * cùng các thông số tương tác: lượt xem (viewCount), lượt thích (likeCount), lượt bình luận (commentCount).
   */
  async findOne(id: number): Promise<AdminUserEntity> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        posts: {
          where: {
            deletedAt: null,
          },
          include: {
            _count: {
              select: {
                postLikes: true,
                comments: true,
              },
            },
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
          },
          orderBy: {
            createdAt: 'desc',
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
   * Khóa tài khoản người dùng và thu hồi toàn bộ session đăng nhập.
   */
  async lockUser(
    userId: number,
    adminId: number,
    lockUserDto: LockUserDto,
  ): Promise<AdminUserEntity> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UserNotFoundException(userId.toString());

    const numericAdminId = Number(adminId);

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.LOCKED,
          lockedAt: new Date(),
          lockedById: numericAdminId,
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
  async unlockUser(userId: number): Promise<AdminUserEntity> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UserNotFoundException(userId.toString());

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
   * Thay đổi vai trò (thêm quyền / tước quyền) của người dùng.
   */
  async changeRole(
    userId: number,
    changeUserRoleDto: ChangeUserRoleDto,
  ): Promise<AdminUserEntity> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UserNotFoundException(userId.toString());

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: changeUserRoleDto.role,
      },
    });

    return new AdminUserEntity(updatedUser);
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
