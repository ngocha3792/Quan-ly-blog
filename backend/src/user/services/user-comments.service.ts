import { BadRequestException, Injectable } from '@nestjs/common';

import {
  CommentsService,
  CommentRateLimitExceededException,
  CreateCommentDto,
  UpdateCommentDto,
} from '@app/core';

import { PrismaService } from '@app/core/core/prisma/prisma.service';

import { CreateUserCommentDto } from '../dto';

/**
 * PostgreSQL advisory-lock namespace riêng
 * cho comment rate limit.
 *
 * pg_advisory_xact_lock(namespace, userId)
 *
 * => request của cùng một user bị serialize.
 *
 * User khác nhau vẫn chạy song song.
 */
const COMMENT_RATE_LIMIT_LOCK_NAMESPACE = 84_001;

const COMMENT_RATE_LIMIT = 5;

const COMMENT_RATE_LIMIT_WINDOW_MS = 60_000;

@Injectable()
export class UserCommentsService {
  constructor(
    private readonly commentsService: CommentsService,

    private readonly prisma: PrismaService,
  ) {}

  async create(userId: number, postId: number, dto: CreateUserCommentDto) {
    const createCommentDto: CreateCommentDto = {
      ...dto,
      postId,
    };

    /**
     * Toàn bộ:
     *
     * advisory lock
     * rate-limit check
     * duplicate check
     * create comment
     *
     * nằm trong cùng transaction.
     */
    return this.prisma.$transaction(async (tx) => {
      /**
       * Serialize các request comment
       * của CÙNG một user.
       *
       * Ví dụ:
       *
       * Request A - user 10
       * Request B - user 10
       *
       * A lấy lock trước.
       * B phải đợi A commit/rollback.
       *
       * Nhưng:
       *
       * user 10
       * user 20
       *
       * vẫn chạy song song vì lock key khác nhau.
       */
      await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            ${COMMENT_RATE_LIMIT_LOCK_NAMESPACE},
            ${userId}
          )
        `;

      const oneMinuteAgo = new Date(Date.now() - COMMENT_RATE_LIMIT_WINDOW_MS);

      /**
       * Không cần COUNT riêng.
       *
       * Ta chỉ cần tối đa 5 comment gần nhất:
       *
       * 0..4 rows
       * => còn được comment.
       *
       * 5 rows
       * => đạt limit.
       *
       * Query này cũng được dùng để
       * check duplicate content.
       */
      const recentComments = await tx.comment.findMany({
        where: {
          userId,

          createdAt: {
            gte: oneMinuteAgo,
          },
        },

        select: {
          postId: true,
          content: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: COMMENT_RATE_LIMIT,
      });

      if (recentComments.length >= COMMENT_RATE_LIMIT) {
        throw new CommentRateLimitExceededException();
      }

      const normalizedContent = dto.content.trim();

      /**
       * Chống duplicate content
       * trong cùng post / cùng 1 phút.
       *
       * Code cũ chỉ so với lastComment.
       *
       * Bây giờ kiểm tra toàn bộ
       * recent comments trong window.
       */
      const duplicatedComment = recentComments.some(
        (comment) =>
          comment.postId === postId &&
          comment.content.trim() === normalizedContent,
      );

      if (duplicatedComment) {
        throw new BadRequestException(
          'Bạn vừa gửi một bình luận có nội dung tương tự.',
        );
      }

      /**
       * Core CommentsService dùng chính tx này.
       *
       * Không thoát ra ngoài transaction.
       */
      return this.commentsService.create(userId, createCommentDto, tx);
    });
  }

  async update(commentId: number, userId: number, dto: UpdateCommentDto) {
    return this.commentsService.update(commentId, userId, dto);
  }

  remove(commentId: number, userId: number) {
    return this.commentsService.remove(commentId, userId);
  }
}
