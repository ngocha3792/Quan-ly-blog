import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  GetPostsDto,
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

@Injectable()
export class PostsPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
    private readonly languagesService: LanguagesService,
  ) { }

  async findAll(
    query: GetPostsDto,
    paginationParams: PaginationParams,
    langCode: string | null,
  ) {
    query.status = PostStatus.PUBLISH;

    if (!query.languageId && langCode) {
      const languageId = await this.languagesService.getIdByCode(langCode);

      if (languageId) {
        query.languageId = languageId;
      }
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
    );

    return {
      ...result,
      items: result.items.map(
        (post) => new PublicPostEntity(post),
      ),
    };
  }

  async findOne(
    id: number,
    langCode: string | null,
    viewerIp: string | null,
  ) {
    let post = new PublicPostEntity(
      await this.postsService.findOne(
        id,
        PUBLIC_POST_INCLUDE,
      ),
    );

    if (post.status !== PostStatus.PUBLISH) {
      throw new PostNotFoundException(id.toString());
    }

    if (langCode) {
      const languageId =
        await this.languagesService.getIdByCode(
          langCode,
        );

      if (
        languageId &&
        post.languageId !== languageId
      ) {
        const parentId =
          post.parentPostId ?? post.id;

        const translatedPost =
          await this.prisma.post.findFirst({
            where: {
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
            include: PUBLIC_POST_INCLUDE,
          });

        if (translatedPost) {
          post = new PublicPostEntity(translatedPost);
        }
      }
    }

    /**
     * Fire-and-forget: ghi log lượt xem + tăng viewCount (có deduplicate chống spam/bot).
     * Không block response trả về cho client.
     */
    const viewerKey = viewerIp || 'anonymous';

    this.recordViewWithDeduplication(post.id, viewerKey).catch(() => {
      /* Bỏ qua lỗi ghi log — không ảnh hưởng trải nghiệm đọc bài */
    });

    return post;
  }

  /**
   * Chống trùng lặp lượt xem (Deduplicate) theo bài viết và IP/user trong khoảng thời gian quy định (5 phút).
   * Sử dụng Serializable transaction + retry khi gặp xung đột ghi (P2034) để chống race condition.
   */
  private async recordViewWithDeduplication(
    postId: number,
    viewerKey: string,
  ): Promise<void> {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const viewedAfter = new Date(
              Date.now() - 5 * 60 * 1000,
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

            if (existingView) return;

            await tx.postViewLog.create({
              data: {
                postId,
                viewerKey,
              },
            });

            await tx.post.update({
              where: { id: postId },
              data: {
                viewCount: {
                  increment: 1,
                },
              },
            });
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        return;
      } catch (error) {
        const canRetry =
          this.isTransactionConflict(error) &&
          attempt < maxRetries - 1;

        if (canRetry) {
          continue;
        }

        throw error;
      }
    }
  }

  private isTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  async getTopPosts(
    limit: number,
    langCode: string | null,
  ) {
    let languageCondition = Prisma.empty;

    if (langCode) {
      const languageId =
        await this.languagesService.getIdByCode(langCode);

      if (languageId) {
        languageCondition = Prisma.sql`
          AND p.language_id = ${languageId}
        `;
      }
    }

    const topPostsIdsRaw =
      await this.prisma.$queryRaw<{ id: number }[]>`
        WITH candidate_posts AS (
          SELECT
            p.id,
            p.view_count,
            p.published_at,
            p.created_at
          FROM posts p
          WHERE p.status = 'PUBLISH'
            AND p.deleted_at IS NULL
            ${languageCondition}
        ),

        like_counts AS (
          SELECT
            pl.post_id,
            COUNT(*)::int AS like_count
          FROM post_likes pl
          INNER JOIN candidate_posts cp
            ON cp.id = pl.post_id
          GROUP BY pl.post_id
        ),

        comment_counts AS (
          SELECT
            c.post_id,
            COUNT(*)::int AS comment_count
          FROM comments c
          INNER JOIN candidate_posts cp
            ON cp.id = c.post_id
          WHERE c.deleted_at IS NULL
          GROUP BY c.post_id
        ),

        bookmark_counts AS (
          SELECT
            pb.post_id,
            COUNT(*)::int AS bookmark_count
          FROM post_bookmarks pb
          INNER JOIN candidate_posts cp
            ON cp.id = pb.post_id
          GROUP BY pb.post_id
        )

        SELECT p.id
        FROM candidate_posts p

        LEFT JOIN like_counts lc
          ON lc.post_id = p.id

        LEFT JOIN comment_counts cc
          ON cc.post_id = p.id

        LEFT JOIN bookmark_counts bc
          ON bc.post_id = p.id

        ORDER BY (
          (
            (0.05 * p.view_count) +
            (2 * COALESCE(lc.like_count, 0)) +
            (5 * COALESCE(cc.comment_count, 0)) +
            (3 * COALESCE(bc.bookmark_count, 0))
          )
          /
          POWER(
            CAST(
              GREATEST(
                EXTRACT(
                  EPOCH FROM (
                    NOW() -
                    COALESCE(
                      p.published_at,
                      p.created_at
                    )
                  )
                ) / 3600.0,
                0
              ) + 2.0
              AS FLOAT
            ),
            1.3
          )
        ) DESC

        LIMIT ${limit}
      `;

    if (topPostsIdsRaw.length === 0) {
      return [];
    }

    const topPostIds =
      topPostsIdsRaw.map((record) => record.id);

    const posts = await this.prisma.post.findMany({
      where: {
        id: {
          in: topPostIds,
        },
      },
      include: PUBLIC_POST_INCLUDE,
    });

    const postMap = new Map(
      posts.map((post) => [post.id, post]),
    );

    const sortedPosts = topPostIds
      .map((postId) => postMap.get(postId))
      .filter(
        (
          post,
        ): post is (typeof posts)[number] =>
          post !== undefined,
      );

    return sortedPosts.map(
      (post) => new PublicPostEntity(post),
    );
  }
}
