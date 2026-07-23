import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostNotFoundException, ExistActionNotAllowedException } from '@app/core/common/exceptions';
import { PostLikeEntity, PostBookmarkEntity } from '@app/core/modules/posts/entities';

@Injectable()
export class PostInteractionService {
    constructor(private readonly prisma: PrismaService) {}

    private async findOnePost(id: number) {
        const post = await this.prisma.post.findFirst({
            where: { id, deletedAt: null }
        });

        if (!post) {
            throw new PostNotFoundException(id.toString());
        }
        return post;
    }

    async likePost(userId: number, postId: number) {
        await this.findOnePost(postId);

        const existingLike = await this.prisma.postLike.findUnique({
            where: {
                postId_userId: {
                    postId,
                    userId,
                }
            }
        });

        if (existingLike) {
            throw new ExistActionNotAllowedException('thích', postId.toString());
        }

        const postLike = await this.prisma.postLike.create({
            data: {
                postId,
                userId,
            }
        });

        return new PostLikeEntity(postLike);
    }

    async unlikePost(userId: number, postId: number) {
        await this.findOnePost(postId);

        const existingLike = await this.prisma.postLike.findUnique({
            where: {
                postId_userId: {
                    postId,
                    userId,
                }
            }
        });

        if (!existingLike) {
            throw new ExistActionNotAllowedException('bỏ thích', postId.toString());
        }

        await this.prisma.postLike.delete({
            where: {
                postId_userId: {
                    postId,
                    userId,
                }
            }
        });

        return { success: true, message: 'Đã bỏ thích bài viết thành công' };
    }

    async bookmarkPost(userId: number, postId: number) {
        await this.findOnePost(postId);

        const existingBookmark = await this.prisma.postBookmark.findUnique({
            where: {
                postId_userId: {
                    postId,
                    userId,
                }
            }
        });

        if (existingBookmark) {
            throw new ExistActionNotAllowedException('lưu', postId.toString());
        }

        const postBookmark = await this.prisma.postBookmark.create({
            data: {
                postId,
                userId,
            }
        });

        return new PostBookmarkEntity(postBookmark);
    }

    async unbookmarkPost(userId: number, postId: number) {
        await this.findOnePost(postId);

        const existingBookmark = await this.prisma.postBookmark.findUnique({
            where: {
                postId_userId: {
                    postId,
                    userId,
                }
            }
        });

        if (!existingBookmark) {
            throw new ExistActionNotAllowedException('bỏ lưu', postId.toString());
        }

        await this.prisma.postBookmark.delete({
            where: {
                postId_userId: {
                    postId,
                    userId,
                }
            }
        });

        return { success: true, message: 'Đã bỏ lưu bài viết thành công' };
    }
}
