import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostStatus, Prisma } from '@prisma/client';
import { TagsService, GetTagsDto, LanguagesService } from '@app/core';
import type { PaginationParams } from '@app/core';

@Injectable()
export class TagsPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tagsService: TagsService,
    private readonly languagesService: LanguagesService,
  ) {}

  async findAll(query: GetTagsDto, paginationParams: PaginationParams) {
    return this.tagsService.findAll(query, paginationParams);
  }

  async getTopTags(
    limit: number = 10,
    langCode: string | null = null,
  ) {
    let languageCondition = Prisma.empty;

    if (langCode) {
      const languageId =
        await this.languagesService.getActiveIdByCode(langCode);

      if (!languageId) {
        return [];
      }

      languageCondition = Prisma.sql`
        AND p.language_id = ${languageId}
      `;
    }

    /**
     * TagScore =
     * AVG(HotScore của các published post thuộc tag)
     */
    const topTagsRaw =
      await this.prisma.$queryRaw<
        {
          tagId: number;
          postCount: number;
          tagScore: number;
        }[]
      >`
        WITH candidate_posts AS (
          SELECT
            p.id,
            p.view_count,
            p.created_at
          FROM posts p

          INNER JOIN languages l
            ON l.id = p.language_id
            AND l.is_active = true
            AND l.deleted_at IS NULL

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
        ),

        post_scores AS (
          SELECT
            p.id,

            (
              (
                (0.05 * p.view_count) +
                (
                  2 *
                  COALESCE(
                    lc.like_count,
                    0
                  )
                ) +
                (
                  5 *
                  COALESCE(
                    cc.comment_count,
                    0
                  )
                ) +
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
                      EPOCH FROM (
                        NOW() - p.created_at
                      )
                    ) / 3600.0,
                    0
                  ) + 2.0
                  AS FLOAT
                ),
                1.3
              )
            ) AS hot_score

          FROM candidate_posts p

          LEFT JOIN like_counts lc
            ON lc.post_id = p.id

          LEFT JOIN comment_counts cc
            ON cc.post_id = p.id

          LEFT JOIN bookmark_counts bc
            ON bc.post_id = p.id
        )

        SELECT
          pt.tag_id AS "tagId",

          COUNT(*)::int AS "postCount",

          AVG(ps.hot_score)
            AS "tagScore"

        FROM post_scores ps

        INNER JOIN post_tags pt
          ON pt.post_id = ps.id

        INNER JOIN tags t
          ON t.id = pt.tag_id
          AND t.deleted_at IS NULL

        GROUP BY pt.tag_id

        ORDER BY "tagScore" DESC

        LIMIT ${limit}
      `;

    if (topTagsRaw.length === 0) {
      return [];
    }

    const tagIds =
      topTagsRaw.map((item) => item.tagId);

    const tags = await this.prisma.tag.findMany({
      where: {
        id: {
          in: tagIds,
        },
        deletedAt: null,
      },
    });

    /**
     * Current code dùng tags.find() cho từng result.
     * Dùng Map để lookup O(1).
     */
    const tagMap = new Map(
      tags.map((tag) => [tag.id, tag]),
    );

    return topTagsRaw.flatMap((item) => {
      const tag = tagMap.get(item.tagId);

      if (!tag) {
        return [];
      }

      return [
        {
          id: tag.id,
          name: tag.name,
          postCount: item.postCount,
          tagScore: item.tagScore,
        },
      ];
    });
  }
}
