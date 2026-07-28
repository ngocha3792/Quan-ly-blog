import { Injectable } from '@nestjs/common';
import {
  PostStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import { PrismaService } from '@app/core';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Việt Nam luôn sử dụng UTC+7 và không có daylight saving time.
 */
const VIETNAM_UTC_OFFSET_HOURS = 7;

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
    const todayStart = this.getVietnamDayStartUtc();
    const tomorrowStart = this.getVietnamDayStartUtc(1);
    const sevenDaysAgoStart = this.getVietnamDayStartUtc(-6);

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
       * Số bài đang chờ Moderator duyệt.
       */
      this.prisma.post.count({
        where: {
          status: PostStatus.PENDING_REVIEW,
          deletedAt: null,
        },
      }),

      /**
       * Số bài đã được Moderator duyệt hoặc từ chối hôm nay.
       */
      this.prisma.post.count({
        where: {
          status: {
            in: [
              PostStatus.PUBLISH,
              PostStatus.REJECT,
            ],
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
            in: [
              ReportStatus.RESOLVED,
              ReportStatus.REJECTED,
            ],
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

    /**
     * Khởi tạo đủ 7 ngày, kể cả những ngày không có report.
     */
    const dailyReportMap = new Map<
      string,
      {
        postReports: number;
        commentReports: number;
      }
    >();

    for (let index = 0; index < 7; index += 1) {
      const dateKey = this.getVietnamDateKey(-6 + index);

      dailyReportMap.set(dateKey, {
        postReports: 0,
        commentReports: 0,
      });
    }

    /**
     * Cộng report theo ngày Việt Nam và loại target.
     */
    for (const report of recentReports) {
      const dateKey = this.formatVietnamDate(
        report.createdAt,
      );

      const current = dailyReportMap.get(dateKey);

      /**
       * Báo cáo nằm ngoài khoảng 7 ngày sẽ không xuất hiện,
       * nhưng vẫn kiểm tra để service an toàn.
       */
      if (!current) {
        continue;
      }

      if (report.targetType === ReportTargetType.POST) {
        current.postReports += 1;
      }

      if (
        report.targetType === ReportTargetType.COMMENT
      ) {
        current.commentReports += 1;
      }
    }

    const last7Days = Array.from(
      dailyReportMap.entries(),
    ).map(([date, counts]) => ({
      date,
      postReports: counts.postReports,
      commentReports: counts.commentReports,
      totalReports:
        counts.postReports + counts.commentReports,
    }));

    return {
      overview: {
        pendingPosts,

        pendingReports:
          pendingPostReports +
          pendingCommentReports,

        pendingPostReports,
        pendingCommentReports,

        activeCategoryGroups,

        processedToday:
          processedPostsToday +
          processedReportsToday,

        processedPostsToday,
        processedReportsToday,
      },

      reportStatusCounts,
      reportReasonCounts,
      last7Days,
    };
  }

  /**
   * Lấy đầu ngày theo giờ Việt Nam nhưng trả về UTC instant.
   *
   * Ví dụ:
   * 2026-07-28 00:00:00 tại Việt Nam
   * -> 2026-07-27T17:00:00.000Z
   */

  /**
 * Lấy tổng số bản ghi từ kết quả groupBy của Prisma.
 *
 * Prisma có thể suy luận _count là:
 * true | object | undefined
 *
 * Vì vậy cần kiểm tra kiểu trước khi lấy _all.
 */
private getGroupCount(count: unknown): number {
  if (
    typeof count !== 'object' ||
    count === null ||
    !('_all' in count)
  ) {
    return 0;
  }

  const total = (count as { _all?: unknown })._all;

  return typeof total === 'number' ? total : 0;
}
  private getVietnamDayStartUtc(offsetDays = 0): Date {
    const calendarDate =
      this.getVietnamCalendarDate(offsetDays);

    return new Date(
      calendarDate.getTime() -
        VIETNAM_UTC_OFFSET_HOURS *
          60 *
          60 *
          1000,
    );
  }

  /**
   * Lấy ngày lịch của Việt Nam và lưu dưới dạng UTC 00:00.
   *
   * Hàm này chỉ dùng để sinh YYYY-MM-DD,
   * không dùng trực tiếp để lọc DateTime.
   */
  private getVietnamCalendarDate(
    offsetDays = 0,
  ): Date {
    const formatter = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: VIETNAM_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
    );

    const parts = formatter.formatToParts(new Date());

    const year = Number(
      parts.find((part) => part.type === 'year')
        ?.value,
    );

    const month = Number(
      parts.find((part) => part.type === 'month')
        ?.value,
    );

    const day = Number(
      parts.find((part) => part.type === 'day')
        ?.value,
    );

    return new Date(
      Date.UTC(
        year,
        month - 1,
        day + offsetDays,
        0,
        0,
        0,
        0,
      ),
    );
  }

  /**
   * Tạo chuỗi ngày YYYY-MM-DD theo giờ Việt Nam.
   */
  private getVietnamDateKey(
    offsetDays = 0,
  ): string {
    return this.getVietnamCalendarDate(offsetDays)
      .toISOString()
      .slice(0, 10);
  }

  /**
   * Chuyển một UTC DateTime thành ngày Việt Nam.
   */
  private formatVietnamDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: VIETNAM_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
    );

    const parts = formatter.formatToParts(date);

    const year = parts.find(
      (part) => part.type === 'year',
    )?.value;

    const month = parts.find(
      (part) => part.type === 'month',
    )?.value;

    const day = parts.find(
      (part) => part.type === 'day',
    )?.value;

    return `${year}-${month}-${day}`;
  }
}