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

    const result = await this.postsService.findAll(
      query,
      paginationParams,
      PUBLIC_POST_INCLUDE,
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
   */
  private async recordViewWithDeduplication(
    postId: number,
    viewerKey: string,
  ): Promise<void> {
    const DEDUPLICATION_WINDOW_MINUTES = 5;
    const since = new Date(
      Date.now() - DEDUPLICATION_WINDOW_MINUTES * 60 * 1000,
    );

    // Kiểm tra xem viewerKey (IP/user) đã được ghi nhận lượt xem cho bài viết này trong vòng 5 phút qua chưa
    const existingLog = await this.prisma.postViewLog.findFirst({
      where: {
        postId,
        viewerKey,
        viewedAt: {
          gte: since,
        },
      },
    });

    // Nếu đã xem trong khoảng thời gian chống trùng lặp -> Bỏ qua không tăng viewCount và không ghi log mới
    if (existingLog) {
      return;
    }

    await Promise.all([
      this.postsService.incrementViewCount(postId),
      this.prisma.postViewLog.create({
        data: {
          postId,
          viewerKey,
        },
      }),
    ]);
  }

  async getTopPosts(limit: number, langCode: string | null) {
    let languageCondition = Prisma.empty;

    if (langCode) {
      const languageId = await this.languagesService.getIdByCode(langCode);

      if (languageId) {
        languageCondition = Prisma.sql`
          AND p.language_id = ${languageId}
        `;
      }
    }

    const topPostsIdsRaw = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT p.id
      FROM posts p
      WHERE p.status = 'PUBLISH'
        AND p.deleted_at IS NULL
        ${languageCondition}
      ORDER BY (
        (
          (0.05 * p.view_count) +
          (
            2 * (
              SELECT COUNT(*)
              FROM post_likes pl
              WHERE pl.post_id = p.id
            )
          ) +
          (
            5 * (
              SELECT COUNT(*)
              FROM comments c
              WHERE c.post_id = p.id
                AND c.deleted_at IS NULL
            )
          ) +
          (
            3 * (
              SELECT COUNT(*)
              FROM post_bookmarks pb
              WHERE pb.post_id = p.id
            )
          )
        ) / POWER(
          CAST(
            GREATEST(
              EXTRACT(
                EPOCH FROM (
                  NOW() - COALESCE(p.published_at, p.created_at)
                )
              ) / 3600.0,
              0
            ) + 2.0 AS FLOAT
          ),
          1.3
        )
      ) DESC
      LIMIT ${limit}
    `;

    if (topPostsIdsRaw.length === 0) {
      return [];
    }

    const topPostIds = topPostsIdsRaw.map((record) => record.id);

    const posts = await this.prisma.post.findMany({
      where: {
        id: {
          in: topPostIds,
        },
      },
      include: PUBLIC_POST_INCLUDE,
    });

    const sortedPosts = topPostIds
      .map((postId) => posts.find((post) => post.id === postId))
      .filter((post): post is NonNullable<typeof post> => post !== undefined);

    return sortedPosts.map(
      (post) => new PublicPostEntity(post),);
  }
}
