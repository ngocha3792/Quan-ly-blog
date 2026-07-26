import { Injectable } from '@nestjs/common';
import { PostStatus } from '@prisma/client';

import { PrismaService } from '@app/core';

@Injectable()
export class BlogownerDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Thống kê dashboard của Blog Owner:
   * - số bài theo trạng thái;
   * - tổng view, like, comment;
   * - view và like trong 7 ngày gần nhất theo giờ Việt Nam.
   */
  async getDashboard(ownerId: number) {
    const today = this.getVietnamDateOnly();
    const startDate = this.getVietnamDateOnly(-6);
    const tomorrow = this.getVietnamDateOnly(1);

    const [
      totalPosts,
      draftPosts,
      pendingReviewPosts,
      publishedPosts,
      rejectedPosts,
      viewAggregate,
      totalLikes,
      totalComments,
      dailyMetrics,
    ] = await this.prisma.$transaction([
      this.prisma.post.count({
        where: {
          authorId: ownerId,
          deletedAt: null,
        },
      }),

      this.prisma.post.count({
        where: {
          authorId: ownerId,
          deletedAt: null,
          status: PostStatus.DRAFT,
        },
      }),

      this.prisma.post.count({
        where: {
          authorId: ownerId,
          deletedAt: null,
          status: PostStatus.PENDING_REVIEW,
        },
      }),

      this.prisma.post.count({
        where: {
          authorId: ownerId,
          deletedAt: null,
          status: PostStatus.PUBLISH,
        },
      }),

      this.prisma.post.count({
        where: {
          authorId: ownerId,
          deletedAt: null,
          status: PostStatus.REJECT,
        },
      }),

      this.prisma.post.aggregate({
        where: {
          authorId: ownerId,
          deletedAt: null,
        },
        _sum: {
          viewCount: true,
        },
      }),

      this.prisma.postLike.count({
        where: {
          post: {
            authorId: ownerId,
            deletedAt: null,
          },
        },
      }),

      this.prisma.comment.count({
        where: {
          deletedAt: null,
          post: {
            authorId: ownerId,
            deletedAt: null,
          },
        },
      }),

      this.prisma.postDailyMetric.findMany({
        where: {
          metricDate: {
            gte: startDate,
            lt: tomorrow,
          },
          post: {
            authorId: ownerId,
            deletedAt: null,
          },
        },
        select: {
          metricDate: true,
          viewCount: true,
          likeCount: true,
        },
        orderBy: {
          metricDate: 'asc',
        },
      }),
    ]);

    /**
     * Cộng số liệu của tất cả bài viết theo từng ngày.
     */
    const metricMap = new Map<
      string,
      {
        views: number;
        likes: number;
      }
    >();

    for (const metric of dailyMetrics) {
      const dateKey = this.formatDate(metric.metricDate);
      const currentMetric = metricMap.get(dateKey) ?? {
        views: 0,
        likes: 0,
      };

      currentMetric.views += metric.viewCount;
      currentMetric.likes += metric.likeCount;

      metricMap.set(dateKey, currentMetric);
    }

    /**
     * Luôn trả đủ 7 ngày.
     * Ngày không có dữ liệu sẽ có views = 0 và likes = 0.
     */
    const last7Days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startDate);

      date.setUTCDate(startDate.getUTCDate() + index);

      const dateKey = this.formatDate(date);
      const metric = metricMap.get(dateKey);

      return {
        date: dateKey,
        views: metric?.views ?? 0,
        likes: metric?.likes ?? 0,
      };
    });

    return {
      postCounts: {
        total: totalPosts,
        draft: draftPosts,
        pendingReview: pendingReviewPosts,
        published: publishedPosts,
        rejected: rejectedPosts,
      },
      totals: {
        views: viewAggregate._sum.viewCount ?? 0,
        likes: totalLikes,
        comments: totalComments,
      },
      last7Days,
    };
  }

  /**
   * Lấy ngày theo múi giờ Việt Nam.
   *
   * offsetDays:
   *  0 = hôm nay
   * -1 = hôm qua
   *  1 = ngày mai
   *
   * Kết quả được đưa về UTC 00:00 để tương thích
   * với cột PostgreSQL DATE.
   */
  private getVietnamDateOnly(offsetDays = 0): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(new Date());

    const year = Number(
      parts.find((part) => part.type === 'year')?.value,
    );

    const month = Number(
      parts.find((part) => part.type === 'month')?.value,
    );

    const day = Number(
      parts.find((part) => part.type === 'day')?.value,
    );

    return new Date(
      Date.UTC(year, month - 1, day + offsetDays, 0, 0, 0, 0),
    );
  }

  /**
   * Chuyển Date thành chuỗi YYYY-MM-DD.
   */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}