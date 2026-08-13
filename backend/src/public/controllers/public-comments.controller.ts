import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';

import {
  GetCommentsDto,
  Public,
} from '@app/core';

import type {
  PaginationParams,
} from '@app/core';

import {
  Pagination,
} from '@app/core/common/decorators';

import {
  GetCommentRepliesDto,
} from '../dto';

import {
  CommentsPublicService,
} from '../services/comments-public.service';

@Controller(
  '/posts/:postId/comments',
)
@UseInterceptors(
  ClassSerializerInterceptor,
)
export class PublicCommentsController {
  constructor(
    private readonly commentsPublicService:
      CommentsPublicService,
  ) {}

  /**
   * GET
   * /api/v1/posts/:postId/comments
   *
   * Root comments dùng page pagination.
   * Mỗi root chỉ có vài replies preview.
   */
  @Public()
  @Get()
  findAllByPost(
    @Param(
      'postId',
      ParseIntPipe,
    )
    postId: number,

    @Query()
    query: GetCommentsDto,

    @Pagination()
    paginationParams:
      PaginationParams,
  ) {
    return this.commentsPublicService
      .findAllByPost(
        postId,
        query,
        paginationParams,
      );
  }

  /**
   * GET
   * /api/v1/posts/:postId/comments/:commentId/replies
   *
   * Replies dùng cursor pagination.
   */
  @Public()
  @Get(':commentId/replies')
  findRepliesByComment(
    @Param(
      'postId',
      ParseIntPipe,
    )
    postId: number,

    @Param(
      'commentId',
      ParseIntPipe,
    )
    commentId: number,

    @Query()
    query: GetCommentRepliesDto,
  ) {
    return this.commentsPublicService
      .findRepliesByComment(
        postId,
        commentId,
        query,
      );
  }
}