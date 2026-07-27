import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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
import type { JwtPayload, PaginationParams } from '@app/core';

import {
  CreateBlogownerPostDto,
  GetBlogownerPostsDto,
  TranslateBlogownerPostDto,
  UpdateBlogownerPostDto,
} from '../dto';

import { BlogownerPostsService } from '../services/blogowner-posts.service';

@Controller('blog-owner/posts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BLOG_OWNER)
@UseInterceptors(ClassSerializerInterceptor)
export class BlogownerPostsController {
  constructor(private readonly blogownerPostsService: BlogownerPostsService) {}

  /**
   * Lấy toàn bộ bài viết của Blog Owner đang đăng nhập.
   *
   * GET /api/v1/blog-owner/posts
   * GET /api/v1/blog-owner/posts?status=DRAFT&page=1&limit=10
   */
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetBlogownerPostsDto,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.blogownerPostsService.findAll(
      Number(user.id),
      query,
      pagination,
    );
  }

  /**
   * Xem chi tiết một bài viết của chính Blog Owner.
   *
   * GET /api/v1/blog-owner/posts/:id
   */
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.blogownerPostsService.findOne(Number(user.id), postId);
  }

  /**
   * Tạo bài viết nháp.
   *
   * POST /api/v1/blog-owner/posts
   *
   * Backend luôn tự gán:
   * status = DRAFT
   * authorId = user đang đăng nhập
   */
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBlogownerPostDto) {
    return this.blogownerPostsService.create(Number(user.id), dto);
  }

  /**
   * Chỉnh sửa bài viết của chính Blog Owner.
   *
   * PATCH /api/v1/blog-owner/posts/:id
   */
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) postId: number,
    @Body() dto: UpdateBlogownerPostDto,
  ) {
    return this.blogownerPostsService.update(Number(user.id), postId, dto);
  }

  /**
   * Xóa mềm bài viết.
   *
   * DELETE /api/v1/blog-owner/posts/:id
   */
  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.blogownerPostsService.remove(Number(user.id), postId);
  }

  /**
   * Gửi bài sang Moderator để duyệt.
   *
   * POST /api/v1/blog-owner/posts/:id/submit
   */
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submitForReview(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.blogownerPostsService.submitForReview(Number(user.id), postId);
  }

  /**
   * Tạo bản dịch của bài viết.
   *
   * POST /api/v1/blog-owner/posts/:id/translations
   */
  @Post(':id/translations')
  translate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) sourcePostId: number,
    @Body() dto: TranslateBlogownerPostDto,
  ) {
    return this.blogownerPostsService.translate(
      Number(user.id),
      sourcePostId,
      dto,
    );
  }
}
