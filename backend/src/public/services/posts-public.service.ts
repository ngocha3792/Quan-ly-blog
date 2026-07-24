import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostsService, GetPostsDto, PostEntity } from '@app/core';
import { PostStatus, Prisma } from '@prisma/client';
import type { PaginationParams } from '@app/core';

const PUBLIC_POST_INCLUDE: Prisma.PostInclude = {
    author: true,
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
    ) {}

    private async getLanguageIdByCode(langCode: string | null): Promise<number | undefined> {
        if (!langCode) return undefined;
        const language = await this.prisma.language.findUnique({
            where: { code: langCode }
        });
        return language?.id;
    }

    async findAll(query: GetPostsDto, paginationParams: PaginationParams, langCode: string | null) {
        query.status = PostStatus.PUBLISH;

        if (!query.languageId && langCode) {
            const languageId = await this.getLanguageIdByCode(langCode);
            if (languageId) {
                query.languageId = languageId;
            }
        }

        return this.postsService.findAll(query, paginationParams, PUBLIC_POST_INCLUDE);
    }

    async findOne(id: number, langCode: string | null) {
        let post = await this.postsService.findOne(id, PUBLIC_POST_INCLUDE);

        if (post.status !== PostStatus.PUBLISH) {
            throw new NotFoundException(`Post with ID ${id} not found`);
        }

        if (langCode) {
            const languageId = await this.getLanguageIdByCode(langCode);

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
                    post = await this.postsService.findOne(translatedPost.id, PUBLIC_POST_INCLUDE);
                }
            }
        }

        return post;
    }

    async getTopPosts(limit: number, langCode: string | null) {
        const where: any = {
            status: PostStatus.PUBLISH,
            deletedAt: null
        };

        if (langCode) {
            const languageId = await this.getLanguageIdByCode(langCode);
            if (languageId) {
                where.languageId = languageId;
            }
        }

        const posts = await this.prisma.post.findMany({
            where,
            orderBy: { viewCount: 'desc' },
            take: limit,
            include: PUBLIC_POST_INCLUDE
        });

        return posts.map(post => new PostEntity(post));
    }
}
