import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { UpdateUserDto, CreateUserDto, GetUsersDto } from './dto/index';
import { UserEntity } from './entities/user.entity';
import { BcryptUtil } from '@app/core/common/utils';
import {
  ExistActionNotAllowedException,
  EmailAlreadyExistsException,
  UsernameAlreadyExistsException,
  UserNotFoundException,
  SelfActionNotAllowedException,
} from '@app/core/common/exceptions';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { Prisma, UserRole, UserStatus } from '@prisma/client';

type UpdateUserInput = Pick<
  UpdateUserDto,
  'password' | 'bio'
> & {
  /**
   * Hai field này là internal input.
   *
   * UserProfileDto không expose avatarUrl/publicId
   * trực tiếp cho client.
   */
  avatarUrl?: string | null;
  avatarPublicId?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private bcryptUtil: BcryptUtil,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { username, email, password } = createUserDto;

    // Kiểm tra email đã tồn tại
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

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
      },
    });

    return new UserEntity(user);
  }

  async findByEmailorUsername(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
        deletedAt: null,
      },
    });
  }

  async findById(id: number, include?: Prisma.UserInclude) {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include,
    });
  }

  async update(id: number, updateUserDto: UpdateUserInput): Promise<UserEntity> {
    // 1. Kiểm tra xem user có tồn tại (và chưa bị xóa) không
    const user = await this.findById(id);
    if (!user) {
      throw new UserNotFoundException(id.toString());
    }

    // 2. Rút trích dữ liệu từ DTO
    const {
      password,
      bio,
      avatarUrl,
      avatarPublicId,
    } = updateUserDto;
    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (bio !== undefined) {
      dataToUpdate.bio = bio;
    }

    if (avatarUrl !== undefined) {
      dataToUpdate.avatarUrl =
        avatarUrl;
    }

    if (
      avatarPublicId !== undefined
    ) {
      (dataToUpdate as any).avatarPublicId =
        avatarPublicId;
    }

    // 3. Nếu người dùng muốn đổi mật khẩu -> Băm mật khẩu mới
    if (password !== undefined) {
      dataToUpdate.passwordHash = await this.bcryptUtil.hashPassword(password);
    }

    // 4. Cập nhật xuống Database
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    return new UserEntity(updatedUser);
  }

  async findAll(
    getUsersDto: GetUsersDto,
    paginationParams: PaginationParams,
  ): Promise<PaginatedResult<UserEntity>> {
    const { search, role, status } = getUsersDto;
    const { skip, take, page } = paginationParams;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    // Thực thi đồng thời 2 truy vấn (lấy data & đếm tổng số) bằng Promise.all
    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((user) => new UserEntity(user)),
      meta: {
        totalItems,
        itemCount: users.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take),
        currentPage: page,
      },
    };
  }

  async remove(id: number) {
    const user = await this.findById(id);
    if (!user) {
      throw new UserNotFoundException(id.toString());
    }

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
    }

    const now = new Date();

    const [deletedUser] = await this.prisma.$transaction([
      // 1. Khóa và đánh dấu xóa mềm người dùng
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: now,
          status: UserStatus.LOCKED,
        },
      }),
      // 2. Thu hồi toàn bộ phiên đăng nhập
      this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
      // 3. Ẩn toàn bộ bài viết của người dùng
      this.prisma.post.updateMany({
        where: { authorId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      // 4. Ẩn toàn bộ bình luận của người dùng
      this.prisma.comment.updateMany({
        where: { userId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    return new UserEntity(deletedUser);
  }

  async restore(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id },
    });
    if (!user) {
      throw new UserNotFoundException(id.toString());
    }

    const restoredUser = await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
      },
    });

    return new UserEntity(restoredUser);
  }
}
