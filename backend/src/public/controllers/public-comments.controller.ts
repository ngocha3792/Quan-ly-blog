import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';

import { Public, GetCommentsDto } from '@app/core';
import type { PaginationParams } from '@app/core';
import { Pagination } from '@app/core/common/decorators';

import { CommentsPublicService } from '../services/comments-public.service';

@Controller('/posts/:postId/comments')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicCommentsController {
  constructor(
    private readonly commentsPublicService: CommentsPublicService,
  ) {}

  /**
   * GET /api/v1/posts/:postId/comments
   *
   * Khách chưa đăng nhập vẫn xem được.
   */
  @Public()
  @Get()
  findAllByPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Query() query: GetCommentsDto,
    @Pagination() paginationParams: PaginationParams,
  ) {
    return this.commentsPublicService.findAllByPost(
      postId,
      query,
      paginationParams,
    );
  }
}