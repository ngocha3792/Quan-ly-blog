import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  GetPostsDto,
  getVietnamCalendarDate,
  JWTUtil,
  LanguagesService,
  PostNotFoundException,
  PostsService,
} from '@app/core';
import { PostStatus, Prisma } from '@prisma/client';
import type { PaginationParams } from '@app/core';
import { PublicPostEntity } from '../entities';

const PUBLIC_POST_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
    },
  },
  postCategories: {
    include: {
      category: {
        include: {
          language: true,
          categoryGroup: true,
        },
      },
    },
  },
  language: true,
  postTags: {
    include: {
      tag: true,
    },
  },
  media: true,
  _count: {
    select: {
      postLikes: true,
    },
  },
} satisfies Prisma.PostInclude;

/**
 * Invariant của Public Post API:
 *
 * Published thôi chưa đủ.
 *
 * Language của bài cũng phải:
 * - active
 * - chưa bị soft delete
 */
const PUBLIC_POST_WHERE = {
  language: {
    is: {
      isActive: true,
      deletedAt: null,
    },
  },
} satisfies Prisma.PostWhereInput;

type TopPostsCacheEntry = {
  ids: number[];
  expiresAt: number;
};

@Injectable()
export class PostsPublicService {
  private readonly topPostsCache = new Map<string, TopPostsCacheEntry>();

  /**
   * GetTopQueryDto hiện max limit = 50.
   *
   * Ta luôn cache tối đa 50 IDs cho mỗi language.
   * Request limit nhỏ hơn chỉ cần slice.
   */
  private readonly topPostsCacheSize = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
    private readonly languagesService: LanguagesService,
    private readonly configService: ConfigService,
    private readonly jwtUtil: JWTUtil,
  ) {}

  private get topPostsCandidateDays(): number {
    return this.configService.get<number>('app.topPostsCandidateDays') ?? 90;
  }

  private get topPostsCacheTtlMs(): number {
    const seconds =
      this.configService.get<number>('app.topPostsCacheTtlSeconds') ?? 120;

    return seconds * 1000;
  }

  private getTopPostsCacheKey(languageId?: number): string {
    return languageId ? `language:${languageId}` : 'all';
  }

  private getCachedTopPostIds(key: string): number[] | null {
    const cached = this.topPostsCache.get(key);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.topPostsCache.delete(key);

      return null;
    }

    return cached.ids;
  }

  private setCachedTopPostIds(key: string, ids: number[]): void {
    this.topPostsCache.set(key, {
      ids,
      expiresAt: Date.now() + this.topPostsCacheTtlMs,
    });
  }

  private async loadRankedPostsByIds(
    rankedIds: number[],
  ): Promise<PublicPostEntity[]> {
    if (rankedIds.length === 0) {
      return [];
    }

    const posts = await this.prisma.post.findMany({
      where: {
        id: {
          in: rankedIds,
        },

        status: PostStatus.PUBLISH,

        deletedAt: null,

        /**
         * Từ bước 5:
         * language phải active + chưa delete.
         */
        ...PUBLIC_POST_WHERE,
      },

      include: PUBLIC_POST_INCLUDE,
    });

    const postMap = new Map(posts.map((post) => [post.id, post]));

    /**
     * findMany WHERE id IN (...)
     * không đảm bảo giữ thứ tự ranking.
     *
     * Phải rebuild theo rankedIds.
     */
    return rankedIds
      .map((postId) => postMap.get(postId))
      .filter((post): post is (typeof posts)[number] => post !== undefined)
      .map((post) => new PublicPostEntity(post));
  }

  async findAll(
    query: GetPostsDto,
    paginationParams: PaginationParams,
    langCode: string | null,
  ) {
    query.status = PostStatus.PUBLISH;

    if (!query.languageId && langCode) {
      const languageId =
        await this.languagesService.getActiveIdByCode(langCode);

      if (!languageId) {
        return {
          items: [],
          meta: {
            totalItems: 0,
            itemCount: 0,
            itemsPerPage: paginationParams.take,
            totalPages: 0,
            currentPage: paginationParams.page,
          },
        };
      }

      query.languageId = languageId;
    }

    const sortField = query.sortBy;
    const sortDirection: 'asc' | 'desc' =
      (query.sortOrder || query.order || 'desc').toLowerCase() === 'asc'
        ? 'asc'
        : 'desc';

    let orderBy:
      | Prisma.PostOrderByWithRelationInput
      | Prisma.PostOrderByWithRelationInput[];

    if (
      sortField === 'views' ||
      sortField === 'viewCount' ||
      sortField === 'viewsCount'
    ) {
      orderBy = { viewCount: sortDirection };
    } else if (sortField === 'title') {
      orderBy = { title: sortDirection };
    } else if (sortField === 'publishedAt') {
      orderBy = { publishedAt: sortDirection };
    } else if (sortField === 'likes' || sortField === 'likesCount') {
      orderBy = { postLikes: { _count: sortDirection } };
    } else {
      orderBy = { createdAt: sortDirection };
    }

    const result = await this.postsService.findAll(
      query,
      paginationParams,
      PUBLIC_POST_INCLUDE,
      orderBy,
      PUBLIC_POST_WHERE,
    );

    return {
      ...result,
      items: result.items.map((post) => new PublicPostEntity(post)),
    };
  }

  async findOne(id: number, langCode: string | null) {
    let post = new PublicPostEntity(
      await this.postsService.findOne(
        id,
        PUBLIC_POST_INCLUDE,
        PUBLIC_POST_WHERE,
      ),
    );

    if (post.status !== PostStatus.PUBLISH) {
      throw new PostNotFoundException(id.toString());
    }

    if (langCode) {
      const languageId =
        await this.languagesService.getActiveIdByCode(langCode);

      if (languageId && post.languageId !== languageId) {
        const parentId = post.parentPostId ?? post.id;

        const translatedPost = await this.prisma.post.findFirst({
          where: {
            AND: [
              {
                OR: [
                  {
                    id: parentId,
                    languageId,
                    status: PostStatus.PUBLISH,
                    deletedAt: null,
                  },
                  {
                    parentPostId: parentId,
                    languageId,
                    status: PostStatus.PUBLISH,
                    deletedAt: null,
                  },
                ],
              },
              PUBLIC_POST_WHERE,
            ],
          },
          include: PUBLIC_POST_INCLUDE,
        });

        if (translatedPost) {
          post = new PublicPostEntity(translatedPost);
        }
      }
    }

    return post;
  }

  async recordView(
    postId: number,
    visitorId: string,
    authorizationHeader: string | null,
  ) {
    /**
     * Chỉ bài public thật sự mới được ghi view.
     *
     * postId là EXACT VERSION đang được đọc,
     * không quy về root.
     */
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.PUBLISH,
        deletedAt: null,
        ...PUBLIC_POST_WHERE,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      throw new PostNotFoundException(postId.toString());
    }

    const viewerUserId =
      this.resolveOptionalViewerUserId(authorizationHeader);

    const viewerKey = this.buildViewerKey(
      postId,
      viewerUserId,
      visitorId,
    );

    /**
     * VIEWER_KEY_SECRET thiếu thì không lưu raw userId/visitorId.
     */
    if (!viewerKey) {
      const currentPost = await this.prisma.post.findUnique({
        where: {
          id: postId,
        },
        select: {
          viewCount: true,
        },
      });

      return {
        counted: false,
        viewCount: currentPost?.viewCount ?? 0,
      };
    }

    const counted = await this.recordViewWithDeduplication(
      postId,
      viewerKey,
    );

    const currentPost = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        viewCount: true,
      },
    });

    return {
      counted,
      viewCount: currentPost?.viewCount ?? 0,
    };
  }

  /**
   * Public API không bắt login.
   *
   * Nhưng nếu request có Bearer token hợp lệ,
   * dùng account ID để phân biệt viewer.
   *
   * Token không có / hết hạn / sai:
   * fallback về anonymous fingerprint,
   * không làm request public bị 401.
   */
  private resolveOptionalViewerUserId(
    authorizationHeader: string | null,
  ): number | null {
    if (!authorizationHeader) {
      return null;
    }

    const [type, token] = authorizationHeader.trim().split(/\s+/);

    if (type?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    try {
      const payload = this.jwtUtil.verifyAccessToken(token);

      const userId = Number(payload?.sub);

      if (!Number.isInteger(userId) || userId <= 0) {
        return null;
      }

      return userId;
    } catch {
      /**
       * Đây là public endpoint.
       *
       * Token lỗi không được khiến bài viết
       * không thể đọc.
       */
      return null;
    }
  }


  /**
   * Tạo pseudonymous viewer key cho EXACT POST VERSION.
   *
   * Logged-in:
   * postId + userId
   *
   * Guest:
   * postId + visitorId
   *
   * Không lưu raw userId/visitorId trong PostViewLog.
   */
  private buildViewerKey(
    postId: number,
    viewerUserId: number | null,
    visitorId: string,
  ): string | null {
    const secret = this.configService.get<string>('app.viewerKeySecret');

    if (!secret) {
      return null;
    }

    let viewerIdentity: string;

    if (viewerUserId !== null) {
      viewerIdentity = `user:${viewerUserId}`;
    } else {
      const normalizedVisitorId = visitorId.trim().toLowerCase();

      if (!normalizedVisitorId) {
        return null;
      }

      viewerIdentity = `guest:${normalizedVisitorId}`;
    }

    const fingerprint = [
      `post:${postId}`,
      viewerIdentity,
    ].join('\n');

    const digest = createHmac('sha256', secret)
      .update(fingerprint)
      .digest('hex');

    /**
     * v3 vì semantics đã đổi:
     *
     * v2 = root + user hoặc IP/UA
     * v3 = exact post + user hoặc visitorId
     */
    return `v3:${digest}`;
  }

  /**
   * Một viewer chỉ được tính một valid view
   * cho cùng EXACT POST VERSION trong 10 phút.
   *
   * Serializable transaction + retry P2034
   * chống race khi nhiều tab gửi request cùng lúc.
   */
  private async recordViewWithDeduplication(
    postId: number,
    viewerKey: string,
  ): Promise<boolean> {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const counted = await this.prisma.$transaction(
          async (tx) => {
            const viewedAfter = new Date(
              Date.now() - 10 * 60 * 1000,
            );

            const existingView = await tx.postViewLog.findFirst({
              where: {
                postId,
                viewerKey,
                viewedAt: {
                  gte: viewedAfter,
                },
              },
              select: {
                id: true,
              },
            });

            /**
             * Tab khác / refresh cùng viewer
             * đã được tính trong 10 phút.
             */
            if (existingView) {
              return false;
            }

            /**
             * Ngày lịch Việt Nam YYYY-MM-DD,
             * lưu dưới dạng UTC 00:00 cho cột @db.Date.
             */
            const metricDate = getVietnamCalendarDate();

            await tx.postViewLog.create({
              data: {
                postId,
                viewerKey,
              },
            });

            /**
             * Tăng đúng version đang được đọc.
             *
             * Xem EN → tăng EN.
             * Xem JA → tăng JA.
             * Không tự quy về ROOT.
             */
            await tx.post.update({
              where: {
                id: postId,
              },
              data: {
                viewCount: {
                  increment: 1,
                },
              },
            });

            /**
             * Đồng thời ghi analytics theo ngày.
             *
             * Post.viewCount và PostDailyMetric
             * phải cùng commit hoặc cùng rollback.
             */
            await tx.postDailyMetric.upsert({
              where: {
                postId_metricDate: {
                  postId,
                  metricDate,
                },
              },
              create: {
                postId,
                metricDate,
                viewCount: 1,
                likeCount: 0,
              },
              update: {
                viewCount: {
                  increment: 1,
                },
              },
            });

            return true;
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        return counted;
      } catch (error) {
        const canRetry =
          this.isTransactionConflict(error) &&
          attempt < maxRetries - 1;

        if (!canRetry) {
          throw error;
        }
      }
    }

    return false;
  }

  private isTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  async getTopPosts(limit: number, langCode: string | null) {
    /**
     * DTO đã validate 1..50,
     * nhưng service vẫn tự bảo vệ.
     */
    const safeLimit = Math.min(Math.max(limit, 1), this.topPostsCacheSize);

    let languageId: number | undefined;

    if (langCode) {
      languageId = await this.languagesService.getActiveIdByCode(langCode);

      /**
       * Language không public:
       * - không tồn tại
       * - inactive
       * - soft deleted
       *
       * Không fallback thành all languages.
       */
      if (!languageId) {
        return [];
      }
    }

    const cacheKey = this.getTopPostsCacheKey(languageId);

    /**
     * ============================
     * CACHE HIT
     * ============================
     *
     * Không chạy aggregate ranking.
     * Chỉ fetch Post hiện tại theo IDs.
     */
    const cachedIds = this.getCachedTopPostIds(cacheKey);

    if (cachedIds) {
      return this.loadRankedPostsByIds(cachedIds.slice(0, safeLimit));
    }

    /**
     * ============================
     * CACHE MISS
     * ============================
     */

    let languageCondition = Prisma.empty;

    if (languageId) {
      languageCondition = Prisma.sql`
          AND p.language_id =
            ${languageId}
        `;
    }

    /**
     * Không aggregate toàn bộ lịch sử.
     *
     * Ranking hiện tại đã có time decay nên
     * post rất cũ gần như không có khả năng
     * đứng top.
     *
     * Giới hạn candidate giúp:
     *
     * 100k posts toàn DB
     *        ↓
     * chỉ aggregate vài nghìn post gần đây
     */
    const candidateSince = new Date(
      Date.now() - this.topPostsCandidateDays * 24 * 60 * 60 * 1000,
    );

    const rankedIdsRaw = await this.prisma.$queryRaw<
      {
        id: number;
      }[]
    >`
        WITH candidate_posts AS (
          SELECT
            p.id,
            p.view_count,
            p.published_at,
            p.created_at

          FROM posts p

          /**
           * Từ bước 5:
           * inactive/deleted language
           * không được tham gia ranking.
           */
          INNER JOIN languages l
            ON l.id =
              p.language_id
            AND l.is_active = true
            AND l.deleted_at
              IS NULL

          WHERE
            p.status = 'PUBLISH'

            AND p.deleted_at
              IS NULL

            /**
             * Ranking chỉ xét bài gần đây.
             */
            AND COALESCE(
              p.published_at,
              p.created_at
            ) >= ${candidateSince}

            ${languageCondition}
        ),

        like_counts AS (
          SELECT
            pl.post_id,
            COUNT(*)::int
              AS like_count

          FROM post_likes pl

          INNER JOIN
            candidate_posts cp
            ON cp.id =
              pl.post_id

          GROUP BY
            pl.post_id
        ),

        comment_counts AS (
          SELECT
            c.post_id,
            COUNT(*)::int
              AS comment_count

          FROM comments c

          INNER JOIN
            candidate_posts cp
            ON cp.id =
              c.post_id

          WHERE
            c.deleted_at
              IS NULL

          GROUP BY
            c.post_id
        ),

        bookmark_counts AS (
          SELECT
            pb.post_id,
            COUNT(*)::int
              AS bookmark_count

          FROM post_bookmarks pb

          INNER JOIN
            candidate_posts cp
            ON cp.id =
              pb.post_id

          GROUP BY
            pb.post_id
        ),

        ranked_posts AS (
          SELECT
            p.id,

            /**
             * Dùng cho deterministic
             * tie-breaker.
             */
            COALESCE(
              p.published_at,
              p.created_at
            ) AS ranking_time,

            (
              (
                (
                  0.05 *
                  p.view_count
                )
                +
                (
                  2 *
                  COALESCE(
                    lc.like_count,
                    0
                  )
                )
                +
                (
                  5 *
                  COALESCE(
                    cc.comment_count,
                    0
                  )
                )
                +
                (
                  3 *
                  COALESCE(
                    bc.bookmark_count,
                    0
                  )
                )
              )
              /
              POWER(
                CAST(
                  GREATEST(
                    EXTRACT(
                      EPOCH
                      FROM (
                        NOW()
                        -
                        COALESCE(
                          p.published_at,
                          p.created_at
                        )
                      )
                    )
                    / 3600.0,
                    0
                  )
                  + 2.0
                  AS FLOAT
                ),
                1.3
              )
            ) AS ranking_score

          FROM candidate_posts p

          LEFT JOIN like_counts lc
            ON lc.post_id =
              p.id

          LEFT JOIN comment_counts cc
            ON cc.post_id =
              p.id

          LEFT JOIN bookmark_counts bc
            ON bc.post_id =
              p.id
        )

        SELECT
          id

        FROM ranked_posts

        ORDER BY
          /**
           * Score cao nhất trước.
           */
          ranking_score DESC,

          /**
           * Nếu score bằng nhau:
           * bài mới hơn trước.
           */
          ranking_time DESC,

          /**
           * Nếu vẫn bằng nhau:
           * ID lớn hơn trước.
           *
           * Giúp result deterministic.
           */
          id DESC

        /**
         * Luôn compute/cache top 50.
         *
         * Request limit 5:
         * cache vẫn dùng lại được
         * cho request limit 10/20/50.
         */
        LIMIT ${this.topPostsCacheSize}
      `;

    const rankedIds = rankedIdsRaw.map((record) => record.id);

    /**
     * Cache kể cả [].
     *
     * Nếu không có post thì tránh
     * request liên tục chạy lại query nặng.
     */
    this.setCachedTopPostIds(cacheKey, rankedIds);

    return this.loadRankedPostsByIds(rankedIds.slice(0, safeLimit));
  }
}
