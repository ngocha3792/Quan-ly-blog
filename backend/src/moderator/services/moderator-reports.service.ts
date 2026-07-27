import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import { PrismaService } from '@app/core';
import type {
  PaginatedResult,
  PaginationParams,
} from '@app/core';

import {
  GetModeratorReportsDto,
  RejectModeratorReportDto,
  ResolveModeratorReportDto,
} from '../dto';
import { ModeratorReportEntity } from '../entities';

/**
 * Thông tin người dùng được trả trong Report.
 */
const REPORT_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

/**
 * Thông tin bài viết bị báo cáo.
 */
const REPORTED_POST_SELECT = {
  id: true,
  title: true,
  thumbnailUrl: true,
  content: true,
  status: true,
  authorId: true,
  publishedAt: true,
  createdAt: true,

  author: {
    select: REPORT_USER_SELECT,
  },
} satisfies Prisma.PostSelect;

/**
 * Thông tin comment cha.
 *
 * Dùng để Moderator hiểu ngữ cảnh nếu comment bị report
 * là một reply.
 */
const PARENT_COMMENT_SELECT = {
  id: true,
  userId: true,
  content: true,
  createdAt: true,

  user: {
    select: REPORT_USER_SELECT,
  },
} satisfies Prisma.CommentSelect;

/**
 * Thông tin bình luận bị báo cáo.
 */
const REPORTED_COMMENT_SELECT = {
  id: true,
  postId: true,
  userId: true,
  parentId: true,
  content: true,
  createdAt: true,

  user: {
    select: REPORT_USER_SELECT,
  },

  post: {
    select: REPORTED_POST_SELECT,
  },

  parent: {
    select: PARENT_COMMENT_SELECT,
  },
} satisfies Prisma.CommentSelect;

/**
 * Toàn bộ ngữ cảnh cần thiết cho Moderator xem report.
 */
const MODERATOR_REPORT_INCLUDE = {
  reporter: {
    select: REPORT_USER_SELECT,
  },

  reviewedBy: {
    select: REPORT_USER_SELECT,
  },

  post: {
    select: REPORTED_POST_SELECT,
  },

  comment: {
    select: REPORTED_COMMENT_SELECT,
  },
} satisfies Prisma.ReportInclude;

@Injectable()
export class ModeratorReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Danh sách report.
   *
   * Mặc định:
   * - chỉ lấy PENDING;
   * - report gửi trước hiển thị trước.
   */
  async findAll(
    query: GetModeratorReportsDto,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ModeratorReportEntity>> {
    const {
      targetType,
      reason,
      reporterId,
      postId,
      commentId,
    } = query;

    const { skip, take, page } = pagination;

    const status = query.status ?? ReportStatus.PENDING;

    const where: Prisma.ReportWhereInput = {
      status,
    };

    if (targetType !== undefined) {
      where.targetType = targetType;
    }

    if (reason !== undefined) {
      where.reason = reason;
    }

    if (reporterId !== undefined) {
      where.reporterId = reporterId;
    }

    if (postId !== undefined) {
      where.postId = postId;
    }

    if (commentId !== undefined) {
      where.commentId = commentId;
    }

    /**
     * Report PENDING:
     * - report cũ nhất xử lý trước.
     *
     * Report đã xử lý:
     * - report xử lý gần nhất hiển thị trước.
     */
    const orderBy: Prisma.ReportOrderByWithRelationInput =
      status === ReportStatus.PENDING
        ? {
            createdAt: 'asc',
          }
        : {
            reviewedAt: 'desc',
          };

    const [reports, totalItems] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take,
        orderBy,
        include: MODERATOR_REPORT_INCLUDE,
      }),

      this.prisma.report.count({
        where,
      }),
    ]);

    return {
      items: reports.map(
        (report) => new ModeratorReportEntity(report),
      ),

      meta: {
        totalItems,
        itemCount: reports.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take),
        currentPage: page,
      },
    };
  }

  /**
   * Xem chi tiết một report.
   *
   * Cho phép xem cả:
   * - PENDING
   * - RESOLVED
   * - REJECTED
   */
  async findOne(
    reportId: number,
  ): Promise<ModeratorReportEntity> {
    const report = await this.prisma.report.findUnique({
      where: {
        id: reportId,
      },
      include: MODERATOR_REPORT_INCLUDE,
    });

    if (!report) {
      throw new NotFoundException(
        `Không tìm thấy báo cáo với ID: ${reportId}.`,
      );
    }

    return new ModeratorReportEntity(report);
  }

  /**
   * Xác nhận report đúng.
   *
   * - Ẩn Post hoặc Comment.
   * - Chuyển toàn bộ report PENDING cùng target
   *   sang RESOLVED.
   */
  async resolve(
    moderatorId: number,
    reportId: number,
    dto: ResolveModeratorReportDto,
  ): Promise<ModeratorReportEntity> {
    const resolvedReport = await this.prisma.$transaction(
      async (tx) => {
        const report = await tx.report.findUnique({
          where: {
            id: reportId,
          },
          select: {
            id: true,
            status: true,
            targetType: true,
            postId: true,
            commentId: true,
          },
        });

        if (!report) {
          throw new NotFoundException(
            `Không tìm thấy báo cáo với ID: ${reportId}.`,
          );
        }

        if (report.status !== ReportStatus.PENDING) {
          throw new BadRequestException(
            `Chỉ có thể xử lý báo cáo đang ở trạng thái PENDING. Trạng thái hiện tại: ${report.status}.`,
          );
        }

        const reviewedAt = new Date();

        /**
         * Claim report đang xét.
         *
         * Điều kiện status=PENDING giúp chống hai Moderator
         * cùng xử lý một report tại cùng thời điểm.
         */
        const claimResult = await tx.report.updateMany({
          where: {
            id: reportId,
            status: ReportStatus.PENDING,
          },
          data: {
            status: ReportStatus.RESOLVED,
            reviewedById: moderatorId,
            reviewedAt,
            resolutionNote: dto.resolutionNote,
          },
        });

        if (claimResult.count !== 1) {
          throw new ConflictException(
            'Báo cáo đã được Moderator khác xử lý. Vui lòng tải lại dữ liệu.',
          );
        }

        if (report.targetType === ReportTargetType.POST) {
          await this.resolvePostReport(
            tx,
            report.postId,
            moderatorId,
            reviewedAt,
            dto.resolutionNote,
          );
        } else if (
          report.targetType === ReportTargetType.COMMENT
        ) {
          await this.resolveCommentReport(
            tx,
            report.commentId,
            moderatorId,
            reviewedAt,
            dto.resolutionNote,
          );
        } else {
          throw new BadRequestException(
            'Loại nội dung của báo cáo không hợp lệ.',
          );
        }

        const result = await tx.report.findUnique({
          where: {
            id: reportId,
          },
          include: MODERATOR_REPORT_INCLUDE,
        });

        if (!result) {
          throw new NotFoundException(
            `Không tìm thấy báo cáo với ID: ${reportId}.`,
          );
        }

        return result;
      },
    );

    return new ModeratorReportEntity(resolvedReport);
  }

  /**
   * Bác bỏ report.
   *
   * Chỉ report đang xét chuyển REJECTED.
   * Post/Comment không bị thay đổi.
   */
  async reject(
    moderatorId: number,
    reportId: number,
    dto: RejectModeratorReportDto,
  ): Promise<ModeratorReportEntity> {
    const rejectedReport = await this.prisma.$transaction(
      async (tx) => {
        const report = await tx.report.findUnique({
          where: {
            id: reportId,
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (!report) {
          throw new NotFoundException(
            `Không tìm thấy báo cáo với ID: ${reportId}.`,
          );
        }

        if (report.status !== ReportStatus.PENDING) {
          throw new BadRequestException(
            `Chỉ có thể bác bỏ báo cáo đang ở trạng thái PENDING. Trạng thái hiện tại: ${report.status}.`,
          );
        }

        const reviewedAt = new Date();

        const updateResult = await tx.report.updateMany({
          where: {
            id: reportId,
            status: ReportStatus.PENDING,
          },
          data: {
            status: ReportStatus.REJECTED,
            reviewedById: moderatorId,
            reviewedAt,
            resolutionNote: dto.resolutionNote,
          },
        });

        if (updateResult.count !== 1) {
          throw new ConflictException(
            'Báo cáo đã được Moderator khác xử lý. Vui lòng tải lại dữ liệu.',
          );
        }

        const result = await tx.report.findUnique({
          where: {
            id: reportId,
          },
          include: MODERATOR_REPORT_INCLUDE,
        });

        if (!result) {
          throw new NotFoundException(
            `Không tìm thấy báo cáo với ID: ${reportId}.`,
          );
        }

        return result;
      },
    );

    return new ModeratorReportEntity(rejectedReport);
  }

  /**
   * Xử lý report nhắm tới bài viết.
   */
  private async resolvePostReport(
    tx: Prisma.TransactionClient,
    postId: number | null,
    moderatorId: number,
    reviewedAt: Date,
    resolutionNote: string,
  ): Promise<void> {
    if (postId === null) {
      throw new BadRequestException(
        'Báo cáo bài viết không chứa postId hợp lệ.',
      );
    }

    /**
     * Ẩn bài viết bằng soft delete.
     */
    const hideResult = await tx.post.updateMany({
      where: {
        id: postId,
        deletedAt: null,
      },
      data: {
        deletedAt: reviewedAt,
      },
    });

    if (hideResult.count !== 1) {
      throw new ConflictException(
        'Bài viết đã bị xóa, bị ẩn hoặc không còn tồn tại.',
      );
    }

    /**
     * Resolve tất cả report PENDING còn lại
     * cùng nhắm tới bài viết này.
     *
     * Report đang xét đã RESOLVED nên không còn khớp
     * điều kiện status=PENDING.
     */
    await tx.report.updateMany({
      where: {
        targetType: ReportTargetType.POST,
        postId,
        status: ReportStatus.PENDING,
      },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: moderatorId,
        reviewedAt,
        resolutionNote,
      },
    });
  }

  /**
   * Xử lý report nhắm tới bình luận.
   */
  private async resolveCommentReport(
    tx: Prisma.TransactionClient,
    commentId: number | null,
    moderatorId: number,
    reviewedAt: Date,
    resolutionNote: string,
  ): Promise<void> {
    if (commentId === null) {
      throw new BadRequestException(
        'Báo cáo bình luận không chứa commentId hợp lệ.',
      );
    }

    /**
     * Ẩn bình luận bằng soft delete.
     */
    const hideResult = await tx.comment.updateMany({
      where: {
        id: commentId,
        deletedAt: null,
      },
      data: {
        deletedAt: reviewedAt,
      },
    });

    if (hideResult.count !== 1) {
      throw new ConflictException(
        'Bình luận đã bị xóa, bị ẩn hoặc không còn tồn tại.',
      );
    }

    /**
     * Resolve tất cả report PENDING còn lại
     * cùng nhắm tới bình luận này.
     */
    await tx.report.updateMany({
      where: {
        targetType: ReportTargetType.COMMENT,
        commentId,
        status: ReportStatus.PENDING,
      },
      data: {
        status: ReportStatus.RESOLVED,
        reviewedById: moderatorId,
        reviewedAt,
        resolutionNote,
      },
    });
  }
}