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
    ) { }

    async findAll(query: GetTagsDto, paginationParams: PaginationParams) {
        return this.tagsService.findAll(query, paginationParams);
    }

    async getTopTags(limit: number = 10, langCode: string | null = null) {
        let languageCondition = Prisma.empty;

        if (langCode) {
            const languageId = await this.languagesService.getIdByCode(langCode);
            if (languageId) {
                languageCondition = Prisma.sql`AND p.language_id = ${languageId}`;
            }
        }
        //Công thức tính điểm của tags TagScore = Σ HotScore của các bài thuộc tag / Tổng số bài của tag
        const topTagsRaw = await this.prisma.$queryRaw<{ tagId: number, postCount: number, tagScore: number }[]>`
            SELECT pt.tag_id as "tagId",
                   COUNT(p.id)::int as "postCount",
                   AVG(
                        (
                            (0.05 * p.view_count) +
                            (2 * COALESCE((SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id), 0)) +
                            (5 * COALESCE((SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL), 0)) +
                            (3 * COALESCE((SELECT COUNT(*) FROM post_bookmarks pb WHERE pb.post_id = p.id), 0))
                        ) / POWER(CAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 0) + 2.0 AS FLOAT), 1.3)
                   ) as "tagScore"
            FROM tags t
            JOIN post_tags pt ON pt.tag_id = t.id
            JOIN posts p ON p.id = pt.post_id
            WHERE p.status = 'PUBLISH' AND p.deleted_at IS NULL AND t.deleted_at IS NULL
            ${languageCondition}
            GROUP BY pt.tag_id
            ORDER BY "tagScore" DESC
            LIMIT ${limit}
        `;

        if (!topTagsRaw.length) return [];

        const tagIds = topTagsRaw.map(t => t.tagId);

        // Lấy chi tiết thông tin của các Tag này
        const tags = await this.prisma.tag.findMany({
            where: { id: { in: tagIds }, deletedAt: null }
        });

        // Map kết quả đếm với thông tin Tag, giữ nguyên thứ tự hot nhất
        return topTagsRaw.map(t => {
            const tag = tags.find(tag => tag.id === t.tagId);
            if (!tag) return null;
            return {
                id: tag.id,
                name: tag.name,
                postCount: t.postCount,
                tagScore: t.tagScore
            };
        }).filter(item => item !== null);
    }
}
