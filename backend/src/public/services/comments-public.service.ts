import { Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
  CommentEntity,
  GetCommentsDto,
  PostNotFoundException,
  PrismaService,
} from '@app/core';
import type {
  PaginatedResult,
  PaginationParams,
} from '@app/core';

/**
 * Thông tin public của người viết bình luận.
 */
const PUBLIC_COMMENT_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

/**
 * Dữ liệu của reply cấp 2.
 */
const PUBLIC_REPLY_SELECT = {
  id: true,
  postId: true,
  userId: true,
  parentId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,

  user: {
    select: PUBLIC_COMMENT_USER_SELECT,
  },
} satisfies Prisma.CommentSelect;

/**
 * Dữ liệu của comment gốc và các reply.
 */
const PUBLIC_COMMENT_SELECT = {
  id: true,
  postId: true,
  userId: true,
  parentId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,

  user: {
    select: PUBLIC_COMMENT_USER_SELECT,
  },

  replies: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: PUBLIC_REPLY_SELECT,
  },
} satisfies Prisma.CommentSelect;

@Injectable()
export class CommentsPublicService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByPost(
    postId: number,
    query: GetCommentsDto,
    paginationParams: PaginationParams,
  ): Promise<PaginatedResult<CommentEntity>> {
    const { skip, take, page } = paginationParams;

    /**
     * Public chỉ được xem bình luận của bài:
     * - Đã PUBLISH.
     * - Chưa bị xóa.
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
      throw new PostNotFoundException(postId.toString());
    }

    /**
     * Chỉ phân trang comment gốc.
     * Reply sẽ nằm lồng trong mỗi comment gốc.
     */
    const where: Prisma.CommentWhereInput = {
      postId,
      parentId: null,
      deletedAt: null,
    };

    const sortField = query.sortBy;
    const sortDirection: 'asc' | 'desc' =
      (query.sortOrder || query.order || 'desc').toLowerCase() === 'asc'
        ? 'asc'
        : 'desc';

    let orderBy: Prisma.CommentOrderByWithRelationInput;
    if (sortField === 'updatedAt') {
      orderBy = { updatedAt: sortDirection };
    } else {
      orderBy = { createdAt: sortDirection };
    }

    const [comments, totalItems] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take,
        orderBy,
        select: PUBLIC_COMMENT_SELECT,
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
}