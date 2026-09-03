import { Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
  PrismaService,
  getVietnamCalendarDate,
  getVietnamDateKey,
  formatVietnamDate,
} from '@app/core';

const FEATURED_POST_LIMIT = 5;

const FEATURED_POST_SELECT = {
  id: true,
  title: true,
  thumbnailUrl: true,
  status: true,
  viewCount: true,
  updatedAt: true,
  language: {
    select: {
      id: true,
      code: true,
      name: true,
      flag: true,
    },
  },
  _count: {
    select: {
      postLikes: true,
    },
  },
} as const;

type FeaturedPostRecord = Prisma.PostGetPayload<{
  select: typeof FEATURED_POST_SELECT;
}>;

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
    const startDate = getVietnamCalendarDate(-6);
    const tomorrow = getVietnamCalendarDate(1);

    /**
 * Tất cả version active của Owner.
 *
 * Dùng cho:
 * - tổng view;
 * - like;
 * - comment;
 * - daily metrics.
 *
 * Vì view của EN/JA vẫn là view thật và phải được tính.
 */
const allPostWhere:
  Prisma.PostWhereInput = {
    authorId: ownerId,
    deletedAt: null,
  };

/**
 * Một logical article = một ROOT.
 *
 * Dùng để đếm số bài viết.
 */
const rootPostWhere:
  Prisma.PostWhereInput = {
    authorId: ownerId,
    parentPostId: null,
    deletedAt: null,
  };

/**
 * Featured card cũng chỉ được trả ROOT,
 * không được đưa translation thành một card riêng.
 */
const publishedRootWhere:
  Prisma.PostWhereInput = {
    ...rootPostWhere,
    status: PostStatus.PUBLISH,
  };

const countPosts =
  (status?: PostStatus) =>
    this.prisma.post.count({
      where: status
        ? {
            ...rootPostWhere,
            status,
          }
        : rootPostWhere,
    });

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
      topPostsByViews,
      topPostsByLikes,
    ] = await this.prisma.$transaction([
      countPosts(),
      countPosts(PostStatus.DRAFT),
      countPosts(PostStatus.PENDING_REVIEW),
      countPosts(PostStatus.PUBLISH),
      countPosts(PostStatus.REJECT),

      this.prisma.post.aggregate({
        where: allPostWhere,
        _sum: {
          viewCount: true,
        },
      }),

      this.prisma.postLike.count({
        where: {
          post: allPostWhere,
        },
      }),

      this.prisma.comment.count({
        where: {
          deletedAt: null,
          post: allPostWhere,
        },
      }),

      this.prisma.postDailyMetric.findMany({
        where: {
          metricDate: {
            gte: startDate,
            lt: tomorrow,
          },
          post: allPostWhere,
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

      this.prisma.post.findMany({
        where: publishedRootWhere,
        select: FEATURED_POST_SELECT,
        orderBy: [
          {
            viewCount: 'desc',
          },
          {
            updatedAt: 'desc',
          },
        ],
        take: FEATURED_POST_LIMIT,
      }),

      this.prisma.post.findMany({
        where: publishedRootWhere,
        select: FEATURED_POST_SELECT,
        orderBy: [
          {
            postLikes: {
              _count: 'desc',
            },
          },
          {
            viewCount: 'desc',
          },
          {
            updatedAt: 'desc',
          },
        ],
        take: FEATURED_POST_LIMIT,
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

    const mapFeaturedPost = (post: FeaturedPostRecord) => ({
      id: post.id,
      title: post.title,
      thumbnailUrl: post.thumbnailUrl,
      status: post.status,
      views: post.viewCount,
      likes: post._count.postLikes,
      language: post.language,
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
      featuredPosts: {
        byViews: topPostsByViews.map(mapFeaturedPost),
        byLikes: topPostsByLikes.map(mapFeaturedPost),
      },
    };
  }
}
