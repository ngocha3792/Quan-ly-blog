import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostsService, GetPostsDto, PostEntity, PostNotFoundException, LanguagesService } from '@app/core';
import { PostStatus, Prisma } from '@prisma/client';
import type { PaginationParams } from '@app/core';

const PUBLIC_POST_INCLUDE: Prisma.PostInclude = {
    author: {
        select: {
            id: true,
            username: true,
            bio: true,
            avatarUrl: true,
        }
    },
    category: true,
    language: true,
    postTags: {
        include: { tag: true }
    }
};

@Injectable()
export class PostsPublicService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly postsService: PostsService,
        private readonly languagesService: LanguagesService,
    ) { }

    async findAll(query: GetPostsDto, paginationParams: PaginationParams, langCode: string | null) {
        query.status = PostStatus.PUBLISH;

        if (!query.languageId && langCode) {
            const languageId = await this.languagesService.getIdByCode(langCode);
            if (languageId) {
                query.languageId = languageId;
            }
        }

        return this.postsService.findAll(query, paginationParams, PUBLIC_POST_INCLUDE);
    }

    async findOne(id: number, langCode: string | null) {
        let post = await this.postsService.findOne(id, PUBLIC_POST_INCLUDE);

        if (post.status !== PostStatus.PUBLISH) {
            throw new PostNotFoundException(id.toString());
        }

        if (langCode) {
            const languageId = await this.languagesService.getIdByCode(langCode);

            if (languageId && post.languageId !== languageId) {
                const parentId = post.parentPostId || post.id;

                const translatedPost = await this.prisma.post.findFirst({
                    where: {
                        OR: [
                            { id: parentId, languageId: languageId, status: PostStatus.PUBLISH, deletedAt: null },
                            { parentPostId: parentId, languageId: languageId, status: PostStatus.PUBLISH, deletedAt: null }
                        ]
                    },
                    include: PUBLIC_POST_INCLUDE
                });

                if (translatedPost) {
                    // Dùng trực tiếp translatedPost đã có include, tránh query lần nữa
                    post = new PostEntity(translatedPost);
                }
            }
        }

        return post;
    }

    async getTopPosts(limit: number, langCode: string | null) {
        let languageCondition = Prisma.empty;

        if (langCode) {
            const languageId = await this.languagesService.getIdByCode(langCode);
            if (languageId) {
                languageCondition = Prisma.sql`AND p.language_id = ${languageId}`;
            }
        }
        //Công thức tính điểm của bài post: InteractionScore =0.05 × Views + 2 × Likes + 5 × Comments + 3 × Bookmarks
        //HotScore = InteractionScore / (AgeInHours + 2)^1.3
        const topPostsIdsRaw = await this.prisma.$queryRaw<{ id: number }[]>`
            SELECT p.id
            FROM posts p
            WHERE p.status = 'PUBLISH' AND p.deleted_at IS NULL
            ${languageCondition}
            ORDER BY (
                (
                    (0.05 * p.view_count) +
                    (2 * (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id)) +
                    (5 * (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL)) +
                    (3 * (SELECT COUNT(*) FROM post_bookmarks pb WHERE pb.post_id = p.id))
                ) / POWER(CAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 0) + 2.0 AS FLOAT), 1.3)
            ) DESC
            LIMIT ${limit}
        `;

        if (!topPostsIdsRaw.length) {
            return [];
        }

        const topPostIds = topPostsIdsRaw.map(r => r.id);

        const posts = await this.prisma.post.findMany({
            where: {
                id: { in: topPostIds }
            },
            include: PUBLIC_POST_INCLUDE
        });

        // Maintain the order from the raw query
        const sortedPosts = topPostIds
            .map(id => posts.find(p => p.id === id))
            .filter((post): post is NonNullable<typeof post> => post != null);

        return sortedPosts.map(post => new PostEntity(post));
    }
}
