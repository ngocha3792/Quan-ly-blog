import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostStatus, UserStatus, UserRole } from '@prisma/client';
import { UserNotFoundException, GetPostsDto } from '@app/core';
import type { PaginationParams } from '@app/core';
import { PostsPublicService } from './posts-public.service';

@Injectable()
export class UsersPublicService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly postsPublicService: PostsPublicService
    ) { }

    async getAuthorInfo(
        authorId: number,
        query: GetPostsDto = new GetPostsDto(),
        paginationParams: PaginationParams = { page: 1, skip: 0, take: 10 },
        langCode: string | null = null
    ) {
        const author = await this.prisma.user.findUnique({
            where: {
                id: authorId,
                status: UserStatus.ACTIVE,
                role: UserRole.BLOG_OWNER,
                deletedAt: null
            },
            select: {
                id: true,
                username: true,
                bio: true,
                avatarUrl: true,
                createdAt: true,
                _count: {
                    select: {
                        posts: {
                            where: {
                                status: PostStatus.PUBLISH,
                                deletedAt: null
                            }
                        }
                    }
                }
            }
        });

        if (!author) {
            throw new UserNotFoundException(authorId.toString());
        }

        const authorInfo = {
            id: author.id,
            username: author.username,
            bio: author.bio,
            avatarUrl: author.avatarUrl,
            createdAt: author.createdAt,
            postCount: author._count.posts
        };

        // Tạo query mới với authorId, tránh mutate object gốc
        const authorQuery = { ...query, authorId };
        const posts = await this.postsPublicService.findAll(authorQuery, paginationParams, langCode);

        return {
            author: authorInfo,
            posts: posts
        };
    }
}
