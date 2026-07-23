import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreatePostDto, UpdatePostDto, GetPostsDto } from './dto';
import { PostEntity } from './entities';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { PostNotFoundException, TagLimitExceptions } from '@app/core/common/exceptions';
import { Prisma, PostStatus } from '@prisma/client';

@Injectable()
export class PostsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(authorId: number, createPostDto: CreatePostDto) {
        const { tagIds, tagNames, ...postData } = createPostDto;

        const data: any = {
            ...postData,
            authorId,
            status: postData.status || PostStatus.DRAFT,
        };

        const finalTagIds = await this.resolveTags(tagIds, tagNames);

        if (finalTagIds.length > 5) {
            throw new TagLimitExceptions(5);
        }

        if (finalTagIds.length > 0) {
            data.postTags = {
                create: finalTagIds.map(tagId => ({ tagId }))
            };
        }

        const post = await this.prisma.post.create({
            data,
        });

        return new PostEntity(post);
    }

    async findAll(query: GetPostsDto, paginationParams: PaginationParams): Promise<PaginatedResult<PostEntity>> {
        const { search, categoryId, languageId, authorId, parentPostId, status, tagId, tagName, bookmarkedByUserId } = query;
        const { skip, take, page } = paginationParams;

        const where: Prisma.PostWhereInput = {
            deletedAt: null,
        };

        if (search) {
            where.title = { contains: search, mode: 'insensitive' };
        }

        if (categoryId) where.categoryId = categoryId;
        if (languageId) where.languageId = languageId;
        if (authorId) where.authorId = authorId;
        if (parentPostId) where.parentPostId = parentPostId;
        if (status) where.status = status;

        if (tagId) {
            where.postTags = {
                some: { tagId }
            };
        } else if (tagName) {
            const tag = await this.prisma.tag.findFirst({ where: { name: tagName } });
            if (tag) {
                where.postTags = { some: { tagId: tag.id } };
            } else {
                where.id = -1;
            }
        }

        if (bookmarkedByUserId) {
            where.postBookmarks = {
                some: { userId: bookmarkedByUserId }
            };
        }

        const [posts, totalItems] = await Promise.all([
            this.prisma.post.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.post.count({ where }),
        ]);

        return {
            items: posts.map(post => new PostEntity(post)),
            meta: {
                totalItems,
                itemCount: posts.length,
                itemsPerPage: take,
                totalPages: Math.ceil(totalItems / take),
                currentPage: page,
            },
        };
    }

    async findOne(id: number) {
        const post = await this.prisma.post.findFirst({
            where: { id, deletedAt: null }
        });

        if (!post) {
            throw new PostNotFoundException(id.toString());
        }

        return new PostEntity(post);
    }

    async update(id: number, updatePostDto: UpdatePostDto) {
        await this.findOne(id);

        const { tagIds, tagNames, ...postData } = updatePostDto;

        const data: any = {
            ...postData
        };

        if (tagIds !== undefined || tagNames !== undefined) {
            const finalTagIds = await this.resolveTags(tagIds, tagNames);

            if (finalTagIds.length > 5) {
                throw new TagLimitExceptions(5);
            }

            data.postTags = {
                deleteMany: {},
                create: finalTagIds.map(tagId => ({ tagId }))
            };
        }

        const updatedPost = await this.prisma.post.update({
            where: { id },
            data,
        });

        return new PostEntity(updatedPost);
    }

    async remove(id: number) {
        await this.findOne(id);

        const deletedPost = await this.prisma.post.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return new PostEntity(deletedPost);
    }

    private async resolveTags(tagIds?: number[], tagNames?: string[]): Promise<number[]> {
        const resolvedTagIds = new Set<number>(tagIds || []);

        if (tagNames && tagNames.length > 0) {
            const normalizedNames = tagNames.map(name => name.trim()).filter(name => name.length > 0);

            if (normalizedNames.length > 0) {
                const existingTags = await this.prisma.tag.findMany({
                    where: { name: { in: normalizedNames } }
                });

                const existingTagNames = existingTags.map(t => t.name);
                const newTagNames = normalizedNames.filter(name => !existingTagNames.includes(name));

                if (newTagNames.length > 0) {
                    await this.prisma.tag.createMany({
                        data: newTagNames.map(name => ({ name })),
                        skipDuplicates: true
                    });

                    const newTags = await this.prisma.tag.findMany({
                        where: { name: { in: newTagNames } }
                    });

                    newTags.forEach(tag => resolvedTagIds.add(tag.id));
                }

                existingTags.forEach(tag => resolvedTagIds.add(tag.id));
            }
        }

        return Array.from(resolvedTagIds);
    }


    async restore(id: number) {
        const post = await this.prisma.post.findFirst({
            where: { id }
        });
        if (!post) {
            throw new PostNotFoundException(id.toString());
        }

        const restoredPost = await this.prisma.post.update({
            where: { id },
            data: { deletedAt: null },
        });

        return new PostEntity(restoredPost);
    }
}
