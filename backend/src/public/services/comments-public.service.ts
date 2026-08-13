import { Injectable } from '@nestjs/common';
import {
  PostStatus,
  Prisma,
} from '@prisma/client';

import {
  CommentEntity,
  CommentNotFoundException,
  GetCommentsDto,
  PostNotFoundException,
  PrismaService,
} from '@app/core';

import type {
  PaginatedResult,
  PaginationParams,
} from '@app/core';

import {
  GetCommentRepliesDto,
} from '../dto';

import {
  PublicCommentEntity,
} from '../entities';

const PUBLIC_REPLY_PREVIEW_LIMIT = 3;

/**
 * Thông tin public của người viết comment.
 */
const PUBLIC_COMMENT_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

/**
 * Dữ liệu của một reply.
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
    select:
      PUBLIC_COMMENT_USER_SELECT,
  },
} satisfies Prisma.CommentSelect;

/**
 * Root comment.
 *
 * Chỉ lấy tối đa 3 replies preview.
 * Tổng replies được lấy bằng _count.
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
    select:
      PUBLIC_COMMENT_USER_SELECT,
  },

  replies: {
    where: {
      deletedAt: null,
    },

    /**
     * ID auto increment nên phù hợp
     * với cursor pagination của replies.
     */
    orderBy: {
      id: 'asc',
    },

    take:
      PUBLIC_REPLY_PREVIEW_LIMIT,

    select:
      PUBLIC_REPLY_SELECT,
  },

  _count: {
    select: {
      replies: {
        where: {
          deletedAt: null,
        },
      },
    },
  },
} satisfies Prisma.CommentSelect;

type CursorPaginatedReplies = {
  items: CommentEntity[];

  meta: {
    itemCount: number;
    hasMore: boolean;
    nextCursor: number | null;
  };
};

@Injectable()
export class CommentsPublicService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /**
   * Danh sách root comments.
   *
   * Root comments:
   * page/limit
   *
   * Replies:
   * chỉ preview 3 phần tử.
   */
  async findAllByPost(
    postId: number,
    query: GetCommentsDto,
    paginationParams:
      PaginationParams,
  ): Promise<
    PaginatedResult<PublicCommentEntity>
  > {
    const {
      skip,
      take,
      page,
    } = paginationParams;

    await this.ensurePublicPost(
      postId,
    );

    const where:
      Prisma.CommentWhereInput = {
        postId,
        parentId: null,
        deletedAt: null,
      };

    const sortDirection:
      'asc' | 'desc' =
      (
        query.sortOrder ||
        query.order ||
        'desc'
      ).toLowerCase() === 'asc'
        ? 'asc'
        : 'desc';

    /**
     * Thêm ID làm tie-breaker.
     *
     * Nếu 2 comments có createdAt giống nhau
     * thì pagination vẫn deterministic.
     */
    const orderBy:
      Prisma.CommentOrderByWithRelationInput[] =
      query.sortBy === 'updatedAt'
        ? [
            {
              updatedAt:
                sortDirection,
            },
            {
              id:
                sortDirection,
            },
          ]
        : [
            {
              createdAt:
                sortDirection,
            },
            {
              id:
                sortDirection,
            },
          ];

    const [
      comments,
      totalItems,
    ] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take,
        orderBy,

        select:
          PUBLIC_COMMENT_SELECT,
      }),

      this.prisma.comment.count({
        where,
      }),
    ]);

    return {
      items: comments.map(
        (comment) =>
          new PublicCommentEntity(
            comment,
          ),
      ),

      meta: {
        totalItems,
        itemCount:
          comments.length,
        itemsPerPage: take,
        totalPages:
          Math.ceil(
            totalItems / take,
          ),
        currentPage: page,
      },
    };
  }

  /**
   * Cursor pagination cho replies.
   *
   * GET
   * /posts/:postId/comments/:commentId/replies
   *
   * ?cursor=123
   * &limit=20
   */
  async findRepliesByComment(
    postId: number,
    commentId: number,
    query: GetCommentRepliesDto,
  ): Promise<
    CursorPaginatedReplies
  > {
    await this.ensurePublicPost(
      postId,
    );

    /**
     * Comment cha phải:
     * - thuộc đúng post
     * - là root comment
     * - chưa bị xóa
     */
    const parentComment =
      await this.prisma.comment.findFirst(
        {
          where: {
            id: commentId,
            postId,
            parentId: null,
            deletedAt: null,
          },

          select: {
            id: true,
          },
        },
      );

    if (!parentComment) {
      throw new CommentNotFoundException(
        commentId.toString(),
      );
    }

    const limit = Math.min(
      Math.max(
        query.limit ?? 20,
        1,
      ),
      50,
    );

    const where:
      Prisma.CommentWhereInput = {
        postId,
        parentId: commentId,
        deletedAt: null,
      };

    /**
     * Cursor là ID cuối cùng client đã nhận.
     *
     * Ví dụ:
     *
     * request 1:
     * 11, 12, 13
     *
     * nextCursor = 13
     *
     * request 2:
     * id > 13
     */
    if (query.cursor) {
      where.id = {
        gt: query.cursor,
      };
    }

    /**
     * Lấy limit + 1 để biết
     * còn trang tiếp theo hay không.
     */
    const replies =
      await this.prisma.comment.findMany(
        {
          where,

          orderBy: {
            id: 'asc',
          },

          take:
            limit + 1,

          select:
            PUBLIC_REPLY_SELECT,
        },
      );

    const hasMore =
      replies.length > limit;

    const pageItems =
      hasMore
        ? replies.slice(
            0,
            limit,
          )
        : replies;

    const lastItem =
      pageItems[
        pageItems.length - 1
      ];

    return {
      items: pageItems.map(
        (reply) =>
          new CommentEntity(
            reply,
          ),
      ),

      meta: {
        itemCount:
          pageItems.length,

        hasMore,

        nextCursor:
          hasMore && lastItem
            ? lastItem.id
            : null,
      },
    };
  }

  /**
   * Public comment API chỉ tồn tại
   * nếu chính post cũng public.
   *
   * Bao gồm invariant từ bước 5:
   * language phải active.
   */
  private async ensurePublicPost(
    postId: number,
  ): Promise<void> {
    const post =
      await this.prisma.post.findFirst(
        {
          where: {
            id: postId,

            status:
              PostStatus.PUBLISH,

            deletedAt: null,

            language: {
              is: {
                isActive: true,
                deletedAt: null,
              },
            },
          },

          select: {
            id: true,
          },
        },
      );

    if (!post) {
      throw new PostNotFoundException(
        postId.toString(),
      );
    }
  }
}