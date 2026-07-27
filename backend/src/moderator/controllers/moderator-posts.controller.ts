import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import {
  CurrentUser,
  JwtAuthGuard,
  Pagination,
  Roles,
  RolesGuard,
} from '@app/core';
import type {
  JwtPayload,
  PaginationParams,
} from '@app/core';

import {
  GetModeratorPostsDto,
  RejectModeratorPostDto,
} from '../dto';
import { ModeratorPostsService } from '../services/moderator-posts.service';

@Controller('moderator/posts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTENT_MODERATOR)
@UseInterceptors(ClassSerializerInterceptor)
export class ModeratorPostsController {
  constructor(
    private readonly moderatorPostsService: ModeratorPostsService,
  ) {}

  /**
   * Danh sách bài Moderator được phép xem.
   *
   * Mặc định chỉ lấy PENDING_REVIEW.
   *
   * GET /api/v1/moderator/posts
   */
  @Get()
  findAll(
    @Query() query: GetModeratorPostsDto,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.moderatorPostsService.findAll(
      query,
      pagination,
    );
  }

  /**
   * Xem chi tiết bài viết.
   *
   * Moderator không được xem bài DRAFT.
   *
   * GET /api/v1/moderator/posts/:postId
   */
  @Get(':postId')
  findOne(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.moderatorPostsService.findOne(postId);
  }

  /**
   * Duyệt bài viết.
   *
   * PENDING_REVIEW -> PUBLISH
   *
   * POST /api/v1/moderator/posts/:postId/approve
   */
  @Post(':postId/approve')
  approve(
    @CurrentUser() moderator: JwtPayload,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.moderatorPostsService.approve(
      Number(moderator.id),
      postId,
    );
  }

  /**
   * Từ chối bài viết.
   *
   * PENDING_REVIEW -> REJECT
   *
   * POST /api/v1/moderator/posts/:postId/reject
   */
  @Post(':postId/reject')
  reject(
    @CurrentUser() moderator: JwtPayload,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: RejectModeratorPostDto,
  ) {
    return this.moderatorPostsService.reject(
      Number(moderator.id),
      postId,
      dto,
    );
  }
}