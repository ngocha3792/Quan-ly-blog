import { Injectable } from '@nestjs/common';
import { BlogOwnerRequestStatus, UserRole } from '@prisma/client';

import {
  BlogOwnerRequestNotFoundException,
  BlogOwnerRequestsService,
  CreateBlogOwnerRequestDto,
  ExistActionNotAllowedException,
  GetBlogOwnerRequestsDto,
  PaginatedResult,
  PaginationParams,
  PrismaService,
  UserNotFoundException,
} from '@app/core';

import { UserBlogOwnerRequestEntity } from '../entities';

@Injectable()
export class UserBlogOwnerRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blogOwnerRequestsService: BlogOwnerRequestsService,
  ) {}

  /**
   * Tạo yêu cầu xin trở thành tác giả blog.
   */
  async create(userId: number, dto: CreateBlogOwnerRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    if (user.role === UserRole.BLOG_OWNER) {
      throw new ExistActionNotAllowedException(
        'đăng ký làm tác giả (bạn đã là tác giả blog)',
        userId.toString(),
      );
    }

    const request = await this.blogOwnerRequestsService.create(userId, dto);
    return new UserBlogOwnerRequestEntity(request);
  }

  /**
   * Lấy danh sách các yêu cầu của chính người dùng hiện tại (có phân trang & lọc theo trạng thái).
   */
  async findAll(
    userId: number,
    query: GetBlogOwnerRequestsDto,
    paginationParams: PaginationParams,
  ): Promise<PaginatedResult<UserBlogOwnerRequestEntity>> {
    const secureQuery: GetBlogOwnerRequestsDto = {
      ...query,
      userId,
    };

    const result = await this.blogOwnerRequestsService.findAll(
      secureQuery,
      paginationParams,
    );

    const items = result.items.map((req) => new UserBlogOwnerRequestEntity(req));

    return {
      items,
      meta: {
        ...result.meta,
        itemCount: items.length,
      },
    };
  }

  /**
   * Xem chi tiết một yêu cầu cụ thể của chính người dùng hiện tại.
   */
  async findOne(userId: number, id: number) {
    const request = await this.blogOwnerRequestsService.findOne(id);

    if (request.userId !== userId) {
      throw new BlogOwnerRequestNotFoundException(id.toString());
    }

    return new UserBlogOwnerRequestEntity(request);
  }

  /**
   * Hủy bỏ / xóa yêu cầu xin làm tác giả (chỉ áp dụng với yêu cầu đang ở trạng thái chờ duyệt PENDING).
   */
  async remove(userId: number, id: number) {
    const request = await this.findOne(userId, id);

    if (request.status !== BlogOwnerRequestStatus.PENDING) {
      throw new ExistActionNotAllowedException(
        'hủy yêu cầu (chỉ có thể hủy yêu cầu đang chờ duyệt PENDING)',
        id.toString(),
      );
    }

    const deletedRequest = await this.blogOwnerRequestsService.remove(id);
    return new UserBlogOwnerRequestEntity(deletedRequest);
  }
}
