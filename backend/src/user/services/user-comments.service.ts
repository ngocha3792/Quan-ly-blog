import { BadRequestException, Injectable } from '@nestjs/common';
import { CommentsService, CreateCommentDto, UpdateCommentDto } from '@app/core';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateUserCommentDto } from '../dto';

@Injectable()
export class UserCommentsService {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly prisma: PrismaService,
  ) {}

  async create(userId: number, postId: number, dto: CreateUserCommentDto) {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // 1. Chống spam: Không quá 5 bình luận trong 1 phút
    const recentCommentsCount = await this.prisma.comment.count({
      where: {
        userId,
        createdAt: {
          gte: oneMinuteAgo,
        },
      },
    });

    if (recentCommentsCount >= 5) {
      throw new BadRequestException(
        'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
      );
    }

    // 2. Chống duplicate: Không gửi bình luận trùng lặp vào cùng 1 bài viết trong 1 phút
    const lastComment = await this.prisma.comment.findFirst({
      where: {
        userId,
        postId,
        createdAt: {
          gte: oneMinuteAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (lastComment && lastComment.content.trim() === dto.content.trim()) {
      throw new BadRequestException(
        'Bạn vừa gửi một bình luận có nội dung tương tự.',
      );
    }

    // 3. Gọi service core
    const createCommentDto: CreateCommentDto = {
      ...dto,
      postId,
    };
    return this.commentsService.create(userId, createCommentDto);
  }

  async update(
    commentId: number,
    userId: number,
    dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(
      commentId,
      userId,
      dto,
    );
  }

  remove(commentId: number, userId: number) {
    return this.commentsService.remove(commentId, userId);
  }
}
