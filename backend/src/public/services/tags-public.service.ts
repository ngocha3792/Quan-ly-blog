import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostStatus } from '@prisma/client';
import { TagsService, GetTagsDto } from '@app/core';
import type { PaginationParams } from '@app/core';

@Injectable()
export class TagsPublicService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tagsService: TagsService,
    ) {}

    async findAll(query: GetTagsDto, paginationParams: PaginationParams) {
        return this.tagsService.findAll(query, paginationParams);
    }

    async getTopTags(limit: number = 10, langCode: string | null = null) {
        let languageId: number | undefined;

        if (langCode) {
            const language = await this.prisma.language.findUnique({
                where: { code: langCode }
            });
            if (language) {
                languageId = language.id;
            }
        }

        // Gom nhóm theo tagId trong bảng PostTag và đếm số lượng,
        // Nhưng chỉ đếm trên các bài viết đã PUBLISH và thuộc ngôn ngữ hiện tại (nếu có)
        const wherePost: any = {
            status: PostStatus.PUBLISH,
            deletedAt: null
        };

        if (languageId) {
            wherePost.languageId = languageId;
        }

        const topTagIds = await this.prisma.postTag.groupBy({
            by: ['tagId'],
            where: {
                post: wherePost
            },
            _count: { tagId: true },
            orderBy: { _count: { tagId: 'desc' } },
            take: limit,
        });

        if (topTagIds.length === 0) return [];

        const tagIds = topTagIds.map(t => t.tagId);

        // Lấy chi tiết thông tin của các Tag này
        const tags = await this.prisma.tag.findMany({
            where: { id: { in: tagIds }, deletedAt: null }
        });

        // Map kết quả đếm với thông tin Tag, giữ nguyên thứ tự hot nhất
        return topTagIds.map(t => {
            const tag = tags.find(tag => tag.id === t.tagId);
            if (!tag) return null;
            return {
                id: tag.id,
                name: tag.name,
                postCount: t._count.tagId
            };
        }).filter(item => item !== null);
    }
}
