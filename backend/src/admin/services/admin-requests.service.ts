import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PrismaService,
  BlogOwnerRequestsService,
  PaginationParams,
  PaginatedResult,
  GetBlogOwnerRequestsDto,
  BlogOwnerRequestEntity,
} from '@app/core';
import { BlogOwnerRequestStatus, UserRole } from '@prisma/client';
import { ReviewBlogOwnerRequestDto } from '../dto';

@Injectable()
export class AdminRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blogOwnerRequestsService: BlogOwnerRequestsService,
  ) {}

  /**
   * Lấy danh sách các yêu cầu trở thành Blog Owner.
   */
  async findAllRequests(
    query: GetBlogOwnerRequestsDto,
    paginationParams: PaginationParams,
  ): Promise<PaginatedResult<BlogOwnerRequestEntity>> {
    return this.blogOwnerRequestsService.findAll(query, paginationParams);
  }

  /**
   * Duyệt hoặc Từ chối yêu cầu trở thành Blog Owner từ người dùng.
   * Nếu duyệt (APPROVED), hệ thống sẽ tự động cập nhật vai trò của User thành BLOG_OWNER.
   */
  async reviewRequest(
    id: number,
    reviewerId: number,
    reviewDto: ReviewBlogOwnerRequestDto,
  ): Promise<BlogOwnerRequestEntity> {
    const request = await this.blogOwnerRequestsService.findOne(id);

    if (request.status !== BlogOwnerRequestStatus.PENDING) {
      throw new BadRequestException(
        `Yêu cầu này đã được xử lý trước đó với trạng thái "${request.status}".`,
      );
    }

    const numericReviewerId = Number(reviewerId);

    const updatedRequest = await this.blogOwnerRequestsService.update(
      id,
      numericReviewerId,
      {
        status: reviewDto.status,
        rejectionReason: reviewDto.rejectionReason,
      },
    );

    // Nếu duyệt yêu cầu -> Cập nhật role của User thành BLOG_OWNER
    if (reviewDto.status === BlogOwnerRequestStatus.APPROVED) {
      await this.prisma.user.update({
        where: { id: request.userId },
        data: { role: UserRole.BLOG_OWNER },
      });
    }

    return updatedRequest;
  }
}
