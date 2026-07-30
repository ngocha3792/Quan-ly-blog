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
    const rejectionReason =
      reviewDto.status === BlogOwnerRequestStatus.APPROVED
        ? null
        : reviewDto.rejectionReason;

    // Sử dụng 1 Prisma Transaction duy nhất để đảm bảo tính nguyên tử (Atomicity) và chống Race Condition khi 2 Admin cùng duyệt
    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái request CHỈ KHI trạng thái hiện tại trong DB vẫn là PENDING
      const updateResult = await tx.blogOwnerRequest.updateMany({
        where: {
          id,
          status: BlogOwnerRequestStatus.PENDING,
        },
        data: {
          status: reviewDto.status,
          rejectionReason,
          reviewedById: numericReviewerId,
          reviewedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          'Yêu cầu này đã được xử lý bởi một quản trị viên khác hoặc không còn ở trạng thái PENDING.',
        );
      }

      // 2. Nếu duyệt yêu cầu -> Cập nhật role của User thành BLOG_OWNER và thu hồi các phiên đăng nhập cũ trong cùng transaction
      if (reviewDto.status === BlogOwnerRequestStatus.APPROVED) {
        await tx.user.update({
          where: { id: request.userId },
          data: { role: UserRole.BLOG_OWNER },
        });

        await tx.userSession.updateMany({
          where: { userId: request.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      // 3. Lấy ra thông tin yêu cầu vừa cập nhật để trả về Entity
      const updatedRequest = await tx.blogOwnerRequest.findUnique({
        where: { id },
      });

      return new BlogOwnerRequestEntity(updatedRequest!);
    });
  }
}
