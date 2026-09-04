import { Injectable } from '@nestjs/common';
import {
  PostStatus,
  Prisma,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import {
  CommentNotFoundException,
  CreateReportDto,
  ExistActionNotAllowedException,
  PostNotFoundException,
  PrismaService,
  ReportsService,
  SelfActionNotAllowedException,
} from '@app/core';

import { CreateUserReportDto } from '../dto';

@Injectable()
export class UserReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  /**
   * Report một bài viết đã xuất bản.
   */
  async reportPost(
    reporterId: number,
    postId: number,
    dto: CreateUserReportDto,
  ) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.PUBLISH,
        deletedAt: null,
      },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!post) {
      throw new PostNotFoundException(postId.toString());
    }

    /**
     * Không cho tác giả report bài viết của chính mình.
     */
    if (post.authorId === reporterId) {
      throw new SelfActionNotAllowedException('report');
    }

    /**
     * Không cho cùng một người gửi nhiều report PENDING
     * đối với cùng một bài viết.
     */
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: ReportTargetType.POST,
        postId,
        status: ReportStatus.PENDING,
      },
      select: {
        id: true,
      },
    });

    if (existingReport) {
      throw new ExistActionNotAllowedException(
        'report',
        `bài viết có ID ${postId}`,
      );
    }

    const createReportDto: CreateReportDto = {
      targetType: ReportTargetType.POST,
      postId,
      reason: dto.reason,
      description: dto.description,
    };

    try {
      return await this.reportsService.create(reporterId, createReportDto);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ExistActionNotAllowedException(
          'report',
          `bài viết có ID ${postId}`,
        );
      }
      throw error;
    }
  }

  /**
   * Report một bình luận thuộc bài viết công khai.
   */
  async reportComment(
    reporterId: number,
    commentId: number,
    dto: CreateUserReportDto,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        deletedAt: null,

        post: {
          status: PostStatus.PUBLISH,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        userId: true,
        postId: true,
      },
    });

    if (!comment) {
      throw new CommentNotFoundException(commentId.toString());
    }

    /**
     * Không cho người viết report bình luận của chính mình.
     */
    if (comment.userId === reporterId) {
      throw new SelfActionNotAllowedException('report');
    }

    /**
     * Không cho cùng một người gửi nhiều report PENDING
     * đối với cùng một bình luận.
     */
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: ReportTargetType.COMMENT,
        commentId,
        status: ReportStatus.PENDING,
      },
      select: {
        id: true,
      },
    });

    if (existingReport) {
      throw new ExistActionNotAllowedException(
        'report',
        `bình luận có ID ${commentId}`,
      );
    }

    const createReportDto: CreateReportDto = {
      targetType: ReportTargetType.COMMENT,
      commentId,
      reason: dto.reason,
      description: dto.description,
    };

    try {
      return await this.reportsService.create(reporterId, createReportDto);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ExistActionNotAllowedException(
          'report',
          `bình luận có ID ${commentId}`,
        );
      }
      throw error;
    }
  }
}
