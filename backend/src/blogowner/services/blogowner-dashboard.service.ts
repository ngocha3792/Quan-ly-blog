import { Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
  PrismaService,
  getVietnamCalendarDate,
  getVietnamDateKey,
  formatVietnamDate,
} from '@app/core';

import type { BlogownerFeaturedSort } from '../dto';

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
   * ============================================================
   * SUMMARY
   * ============================================================
   *
   * postCounts:
   * - đếm logical article bằng ROOT.
   *
   * totals:
   * - views / likes / comments tính trên TẤT CẢ version
   *   của BlogOwner, gồm root + translations.
   */
  async getSummary(ownerId: number) {
    const allPostWhere: Prisma.PostWhereInput = {
      authorId: ownerId,
      deletedAt: null,
    };

    const rootPostWhere: Prisma.PostWhereInput = {
      authorId: ownerId,
      parentPostId: null,
      deletedAt: null,
    };

    const countPosts = (status?: PostStatus) =>
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
    ]);

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
    };
  }

  /**
   * ============================================================
   * ACTIVITY
   * ============================================================
   *
   * View:
   * - số valid view phát sinh trong ngày.
   *
   * Like:
   * - NET CHANGE của ngày.
   * - LIKE   = +1
   * - UNLIKE = -1
   *
   * Vì vậy likes hoàn toàn có thể âm.
   */
  async getActivity(ownerId: number, days = 7) {
    const startDate = getVietnamCalendarDate(-(days - 1));
    const tomorrow = getVietnamCalendarDate(1);

    const allPostWhere: Prisma.PostWhereInput = {
      authorId: ownerId,
      deletedAt: null,
    };

    const dailyMetrics =
      await this.prisma.postDailyMetric.findMany({
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
      });

    const metricMap = new Map<
      string,
      {
        views: number;
        likes: number;
      }
    >();

    /**
     * Có thể có nhiều record cùng ngày vì:
     *
     * ROOT VI
     * EN
     * JA
     * ...
     *
     * Dashboard Owner cộng tất cả version lại.
     */
    for (const metric of dailyMetrics) {
      const dateKey = formatVietnamDate(
        metric.metricDate,
      );

      const currentMetric =
        metricMap.get(dateKey) ?? {
          views: 0,
          likes: 0,
        };

      currentMetric.views += metric.viewCount;
      currentMetric.likes += metric.likeCount;

      metricMap.set(dateKey, currentMetric);
    }

    /**
     * Luôn trả đủ số ngày yêu cầu.
     *
     * Ngày không có interaction:
     * views = 0
     * likes = 0
     */
    const last7Days = Array.from(
      {
        length: days,
      },
      (_, index) => {
        const dateKey = getVietnamDateKey(
          -(days - 1) + index,
        );

        const metric = metricMap.get(dateKey);

        return {
          date: dateKey,
          views: metric?.views ?? 0,
          likes: metric?.likes ?? 0,
        };
      },
    );

    return {
      days,
      last7Days,
    };
  }

  /**
   * ============================================================
   * FEATURED POSTS
   * ============================================================
   *
   * Khác với danh sách "Bài viết của tôi":
   *
   * Featured KHÔNG group root + translation.
   *
   * Mỗi exact Post tự cạnh tranh bằng:
   * - viewCount của chính Post đó;
   * - số PostLike của chính Post đó.
   *
   * Vì vậy:
   * - ROOT có thể lọt top;
   * - EN có thể lọt top;
   * - JA có thể lọt top;
   * - nhiều version cùng một article cũng có thể cùng lọt top.
   */
  async getFeatured(
    ownerId: number,
    sort: BlogownerFeaturedSort = 'views',
    limit = 5,
  ) {
    const publishedPostWhere: Prisma.PostWhereInput = {
      authorId: ownerId,
      status: PostStatus.PUBLISH,
      deletedAt: null,
    };

    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      sort === 'likes'
        ? [
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
            {
              id: 'desc',
            },
          ]
        : [
            {
              viewCount: 'desc',
            },
            {
              postLikes: {
                _count: 'desc',
              },
            },
            {
              updatedAt: 'desc',
            },
            {
              id: 'desc',
            },
          ];

    const posts = await this.prisma.post.findMany({
      where: publishedPostWhere,
      select: FEATURED_POST_SELECT,
      orderBy,
      take: limit,
    });

    return {
      sort,
      posts: posts.map((post) =>
        this.mapFeaturedPost(post),
      ),
    };
  }

  /**
   * ============================================================
   * LEGACY DASHBOARD
   * ============================================================
   *
   * Giữ response cũ để không làm FE cũ hỏng.
   *
   * Khi FE mới đã chuyển hoàn toàn sang:
   * - summary
   * - activity
   * - featured
   *
   * endpoint này có thể deprecate sau.
   */
  async getDashboard(ownerId: number) {
    const [
      summary,
      activity,
      featuredByViews,
      featuredByLikes,
    ] = await Promise.all([
      this.getSummary(ownerId),
      this.getActivity(ownerId, 7),
      this.getFeatured(ownerId, 'views', 5),
      this.getFeatured(ownerId, 'likes', 5),
    ]);

    return {
      ...summary,

      last7Days: activity.last7Days,

      featuredPosts: {
        byViews: featuredByViews.posts,
        byLikes: featuredByLikes.posts,
      },
    };
  }

  private mapFeaturedPost(post: FeaturedPostRecord) {
    return {
      id: post.id,
      title: post.title,
      thumbnailUrl: post.thumbnailUrl,
      status: post.status,
      views: post.viewCount,
      likes: post._count.postLikes,
      language: post.language,
    };
  }
}