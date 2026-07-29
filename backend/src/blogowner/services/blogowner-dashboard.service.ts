import { Injectable } from '@nestjs/common';
import { PostStatus } from '@prisma/client';

import { PrismaService, getVietnamCalendarDate, getVietnamDateKey, formatVietnamDate } from '@app/core';

@Injectable()
export class BlogownerDashboardService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Thống kê dashboard của Blog Owner:
   * - số bài theo trạng thái;
   * - tổng view, like, comment;
   * - view và like trong 7 ngày gần nhất theo giờ Việt Nam.
   */
  async getDashboard(ownerId: number) {
    const startDate = getVietnamCalendarDate(-6);
    const tomorrow = getVietnamCalendarDate(1);

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
      const dateKey = formatVietnamDate(metric.metricDate);
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
      const dateKey = getVietnamDateKey(-6 + index);
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
}