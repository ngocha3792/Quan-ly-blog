import { Injectable } from '@nestjs/common';
import {
  PostStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import {
  PrismaService,
  getVietnamDayStartUtc,
  getVietnamDateKey,
  formatVietnamDate,
} from '@app/core';

@Injectable()
export class ModeratorDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Thống kê tổng quan cho Moderator.
   *
   * Bao gồm:
   * - bài viết đang chờ duyệt;
   * - report đang chờ xử lý;
   * - số nhóm category đang hoạt động;
   * - số nội dung đã xử lý hôm nay;
   * - trạng thái và nguyên nhân report;
   * - lượng report trong 7 ngày gần nhất.
   */
  async getDashboard() {
    /**
     * Báo cáo sử dụng createdAt/reviewedAt kiểu DateTime,
     * vì vậy phải quy đổi đầu ngày Việt Nam thành UTC.
     *
     * Ví dụ:
     * 00:00 ngày 28/07 tại Việt Nam
     * = 17:00 ngày 27/07 theo UTC.
     */
    const todayStart = getVietnamDayStartUtc();
    const tomorrowStart = getVietnamDayStartUtc(1);
    const sevenDaysAgoStart = getVietnamDayStartUtc(-6);

    const [
      pendingPosts,
      processedPostsToday,

      pendingPostReports,
      pendingCommentReports,
      processedReportsToday,

      activeCategoryGroups,

      statusGroups,
      reasonGroups,
      recentReports,
    ] = await this.prisma.$transaction([
      /**
       * Dashboard đếm theo article group.
       *
       * Mỗi bài đa ngôn ngữ gồm:
       * ROOT + các translation.
       */
      this.prisma.post.count({
        where: {
          parentPostId: null,
          status: PostStatus.PENDING_REVIEW,
          deletedAt: null,
        },
      }),

      /**
       * Số bài đã được Moderator duyệt hoặc từ chối hôm nay.
       */
      this.prisma.post.count({
        where: {
          /**
           * Chỉ đếm ROOT.
           *
           * Khi Moderator approve/reject một article group,
           * ROOT và translations đều được cập nhật trạng thái.
           * Nếu không lọc ROOT thì một bài đa ngôn ngữ
           * sẽ bị tính nhiều lần.
           */
          parentPostId: null,

          status: {
            in: [PostStatus.PUBLISH, PostStatus.REJECT],
          },

          reviewedAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },

          reviewedById: {
            not: null,
          },

          deletedAt: null,
        },
      }),

      /**
       * Report bài viết đang chờ xử lý.
       */
      this.prisma.report.count({
        where: {
          targetType: ReportTargetType.POST,
          status: ReportStatus.PENDING,
        },
      }),

      /**
       * Report bình luận đang chờ xử lý.
       */
      this.prisma.report.count({
        where: {
          targetType: ReportTargetType.COMMENT,
          status: ReportStatus.PENDING,
        },
      }),

      /**
       * Report được xác nhận hoặc bác bỏ hôm nay.
       */
      this.prisma.report.count({
        where: {
          status: {
            in: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
          },

          reviewedAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },

          reviewedById: {
            not: null,
          },
        },
      }),

      /**
       * Đếm CategoryGroup thay vì đếm từng bản dịch.
       *
       * Một group có bốn ngôn ngữ vẫn chỉ tính là một category.
       */
      this.prisma.categoryGroup.count({
        where: {
          deletedAt: null,
        },
      }),

      /**
       * Tổng số report theo trạng thái.
       */
      this.prisma.report.groupBy({
        by: ['status'],

        orderBy: {
          status: 'asc',
        },

        _count: {
          _all: true,
        },
      }),

      /**
       * Tổng số report theo nguyên nhân.
       */
      this.prisma.report.groupBy({
        by: ['reason'],

        orderBy: {
          reason: 'asc',
        },

        _count: {
          _all: true,
        },
      }),

      /**
       * Các report được tạo trong 7 ngày gần nhất.
       *
       * Phần tổng hợp theo ngày được xử lý trong JavaScript
       * để tránh phụ thuộc câu lệnh SQL riêng của PostgreSQL.
       */
      this.prisma.report.findMany({
        where: {
          createdAt: {
            gte: sevenDaysAgoStart,
            lt: tomorrowStart,
          },
        },

        select: {
          targetType: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);

    const reportStatusCounts = this.mapReportStatusCounts(statusGroups);
    const reportReasonCounts = this.mapReportReasonCounts(reasonGroups);
    const last7Days = this.mapLast7DaysReports(recentReports);

    return {
      overview: {
        pendingPosts,

        pendingReports: pendingPostReports + pendingCommentReports,

        pendingPostReports,
        pendingCommentReports,

        activeCategoryGroups,

        processedToday: processedPostsToday + processedReportsToday,

        processedPostsToday,
        processedReportsToday,
      },

      reportStatusCounts,
      reportReasonCounts,
      last7Days,
    };
  }

  /**
   * Lấy tổng số bản ghi từ kết quả groupBy của Prisma.
   *
   * Prisma có thể suy luận _count là:
   * true | object | undefined
   *
   * Vì vậy cần kiểm tra kiểu trước khi lấy _all.
   */
  private getGroupCount(count: unknown): number {
    if (typeof count !== 'object' || count === null || !('_all' in count)) {
      return 0;
    }

    const total = (count as { _all?: unknown })._all;

    return typeof total === 'number' ? total : 0;
  }

  private mapReportStatusCounts(
    statusGroups: { status: ReportStatus; _count: unknown }[],
  ) {
    const reportStatusCounts = {
      pending: 0,
      resolved: 0,
      rejected: 0,
    };

    for (const group of statusGroups) {
      const count = this.getGroupCount(group._count);

      switch (group.status) {
        case ReportStatus.PENDING:
          reportStatusCounts.pending = count;
          break;

        case ReportStatus.RESOLVED:
          reportStatusCounts.resolved = count;
          break;

        case ReportStatus.REJECTED:
          reportStatusCounts.rejected = count;
          break;
      }
    }

    return reportStatusCounts;
  }

  private mapReportReasonCounts(
    reasonGroups: { reason: ReportReason; _count: unknown }[],
  ) {
    const reportReasonCounts = {
      spam: 0,
      harassment: 0,
      inappropriate: 0,
      copyright: 0,
      misinformation: 0,
      other: 0,
    };

    for (const group of reasonGroups) {
      const count = this.getGroupCount(group._count);

      switch (group.reason) {
        case ReportReason.SPAM:
          reportReasonCounts.spam = count;
          break;

        case ReportReason.HARASSMENT:
          reportReasonCounts.harassment = count;
          break;

        case ReportReason.INAPPROPRIATE:
          reportReasonCounts.inappropriate = count;
          break;

        case ReportReason.COPYRIGHT:
          reportReasonCounts.copyright = count;
          break;

        case ReportReason.MISINFORMATION:
          reportReasonCounts.misinformation = count;
          break;

        case ReportReason.OTHER:
          reportReasonCounts.other = count;
          break;
      }
    }

    return reportReasonCounts;
  }

  private mapLast7DaysReports(
    recentReports: { targetType: ReportTargetType; createdAt: Date }[],
  ) {
    const dailyReportMap = new Map<
      string,
      {
        postReports: number;
        commentReports: number;
      }
    >();

    for (let index = 0; index < 7; index += 1) {
      const dateKey = getVietnamDateKey(-6 + index);

      dailyReportMap.set(dateKey, {
        postReports: 0,
        commentReports: 0,
      });
    }

    for (const report of recentReports) {
      const dateKey = formatVietnamDate(report.createdAt);

      const current = dailyReportMap.get(dateKey);

      if (!current) {
        continue;
      }

      if (report.targetType === ReportTargetType.POST) {
        current.postReports += 1;
      }

      if (report.targetType === ReportTargetType.COMMENT) {
        current.commentReports += 1;
      }
    }

    return Array.from(dailyReportMap.entries()).map(([date, counts]) => ({
      date,
      postReports: counts.postReports,
      commentReports: counts.commentReports,
      totalReports: counts.postReports + counts.commentReports,
    }));
  }
}
