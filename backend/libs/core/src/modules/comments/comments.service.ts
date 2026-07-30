import { BadRequestException, Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  CommentNotFoundException,
  NotCommentOwnerException,
} from '@app/core/common/exceptions';
import {
  PaginatedResult,
  PaginationParams,
} from '@app/core/common/interfaces';

import {
  CreateCommentDto,
  GetCommentsDto,
  UpdateCommentDto,
} from './dto';
import { CommentEntity } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: number, createCommentDto: CreateCommentDto) {
    const {
      postId,
      parentId: requestedParentId,
      content,
    } = createCommentDto;

    /**
     * Chỉ được bình luận bài:
     * - Đang PUBLISH.
     * - Chưa bị xóa mềm.
     */
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.PUBLISH,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      throw new BadRequestException(
        'Chỉ có thể bình luận trên bài viết đã xuất bản và chưa bị xóa.',
      );
    }

    let parentId: number | null = requestedParentId ?? null;

    if (
      requestedParentId !== undefined &&
      requestedParentId !== null
    ) {
      const parentComment = await this.prisma.comment.findFirst({
        where: {
          id: requestedParentId,
          deletedAt: null,
        },
        select: {
          id: true,
          postId: true,
          parentId: true,
        },
      });

      if (!parentComment) {
        throw new CommentNotFoundException(
          requestedParentId.toString(),
        );
      }

      /**
       * Không cho lấy comment của bài A
       * làm comment cha trong bài B.
       */
      if (parentComment.postId !== postId) {
        throw new BadRequestException(
          'Bình luận cha không thuộc bài viết này.',
        );
      }

      /**
       * Chỉ hỗ trợ tối đa hai cấp:
       *
       * Comment gốc
       * └── Reply
       *
       * Khi reply vào một reply, hệ thống đưa comment mới
       * về cùng comment gốc.
       */
      if (parentComment.parentId !== null) {
        parentId = parentComment.parentId;
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        userId,
        parentId,
        content,
      },
    });

    return new CommentEntity(comment);
  }

  async findAll(
    query: GetCommentsDto,
    paginationParams: PaginationParams,
  ): Promise<PaginatedResult<CommentEntity>> {
    const { postId, parentId, userId } = query;
    const { skip, take, page } = paginationParams;

    const where: Prisma.CommentWhereInput = {
      deletedAt: null,
    };

    if (postId !== undefined) {
      where.postId = postId;
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    if (userId !== undefined) {
      where.userId = userId;
    }

    const [comments, totalItems] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.comment.count({
        where,
      }),
    ]);

    return {
      items: comments.map(
        (comment) => new CommentEntity(comment),
      ),
      meta: {
        totalItems,
        itemCount: comments.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take),
        currentPage: page,
      },
    };
  }

  async findOne(id: number) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!comment) {
      throw new CommentNotFoundException(id.toString());
    }

    return new CommentEntity(comment);
  }

  async update(
    id: number,
    userId: number,
    updateCommentDto: UpdateCommentDto,
  ) {
    const comment = await this.findOne(id);

    if (comment.userId !== userId) {
      throw new NotCommentOwnerException();
    }

    const updatedComment = await this.prisma.comment.update({
      where: {
        id,
      },
      data: {
        content: updateCommentDto.content,
      },
    });

    return new CommentEntity(updatedComment);
  }

  async remove(id: number, userId: number) {
    const comment = await this.findOne(id);

    if (comment.userId !== userId) {
      throw new NotCommentOwnerException();
    }

    const deletedComment = await this.prisma.comment.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return new CommentEntity(deletedComment);
  }

  async restore(id: number) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id,
      },
    });

    if (!comment) {
      throw new CommentNotFoundException(id.toString());
    }

    const restoredComment = await this.prisma.comment.update({
      where: {
        id,
      },
      data: {
        deletedAt: null,
      },
    });

    return new CommentEntity(restoredComment);
  }
}

