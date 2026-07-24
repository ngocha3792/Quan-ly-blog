import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateCommentDto, UpdateCommentDto, GetCommentsDto } from './dto';
import { CommentEntity } from './entities/comment.entity';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { Prisma } from '@prisma/client';
import { CommentNotFoundException, NotCommentOwnerException } from '@app/core/common/exceptions';

@Injectable()
export class CommentsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: number, createCommentDto: CreateCommentDto) {
        let { parentId } = createCommentDto;

        if (parentId) {
            const parentComment = await this.prisma.comment.findFirst({
                where: { id: parentId, deletedAt: null }
            });

            if (!parentComment) {
                throw new CommentNotFoundException(parentId.toString());
            }

            // Ép phẳng cây bình luận (chỉ cho phép tối đa 2 cấp)
            // Nếu bình luận cha đã có parentId (nghĩa là nó là cấp 2),
            // ta lấy parentId của nó gán cho bình luận mới.
            if (parentComment.parentId !== null) {
                parentId = parentComment.parentId;
            }
        }

        const comment = await this.prisma.comment.create({
            data: {
                ...createCommentDto,
                parentId,
                userId,
            }
        });

        return new CommentEntity(comment);
    }

    async findAll(query: GetCommentsDto, paginationParams: PaginationParams): Promise<PaginatedResult<CommentEntity>> {
        const { postId, parentId, userId } = query;
        const { skip, take, page } = paginationParams;

        const where: Prisma.CommentWhereInput = {
            deletedAt: null,
        };

        if (postId) where.postId = postId;

        // Hỗ trợ truyền parentId để lấy bình luận cấp 1 (root) hoặc các reply
        if (parentId !== undefined) {
            where.parentId = parentId;
        }

        if (userId) where.userId = userId;

        const [comments, totalItems] = await Promise.all([
            this.prisma.comment.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.comment.count({ where }),
        ]);

        return {
            items: comments.map(comment => new CommentEntity(comment)),
            meta: {
                totalItems,
                itemCount: comments.length,
                itemsPerPage: take,
                totalPages: Math.ceil(totalItems / take),
                currentPage: page,
            }
        };
    }

    async findOne(id: number) {
        const comment = await this.prisma.comment.findFirst({
            where: { id, deletedAt: null }
        });

        if (!comment) {
            throw new CommentNotFoundException(id.toString());
        }

        return new CommentEntity(comment);
    }

    async update(id: number, userId: number, updateCommentDto: UpdateCommentDto) {
        const comment = await this.findOne(id);

        if (comment.userId !== userId) {
            throw new NotCommentOwnerException();
        }

        const updatedComment = await this.prisma.comment.update({
            where: { id },
            data: updateCommentDto
        });

        return new CommentEntity(updatedComment);
    }

    async remove(id: number, userId: number) {
        const comment = await this.findOne(id);

        // TODO: Admin cũng nên được quyền xóa. Tạm thời chỉ chủ bình luận mới xóa được.
        if (comment.userId !== userId) {
            throw new NotCommentOwnerException();
        }

        const deletedComment = await this.prisma.comment.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        return new CommentEntity(deletedComment);
    }

    async restore(id: number) {
        const comment = await this.prisma.comment.findFirst({
            where: { id }
        });
        if (!comment) {
            throw new CommentNotFoundException(id.toString());
        }

        const restoredComment = await this.prisma.comment.update({
            where: { id },
            data: { deletedAt: null }
        });

        return new CommentEntity(restoredComment);
    }
}
