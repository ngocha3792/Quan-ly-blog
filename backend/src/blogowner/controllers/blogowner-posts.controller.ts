/// <reference types="multer" />

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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';

import {
  CurrentUser,
  JwtAuthGuard,
  Pagination,
  Roles,
  RolesGuard,
} from '@app/core';
import type { AuthenticatedUser, PaginationParams } from '@app/core';

import {
  AutoTranslateBlogownerPostDto,
  CreateBlogownerPostDto,
  GetBlogownerPostsDto,
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
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetBlogownerPostsDto,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.blogownerPostsService.findAll(user.id, query, pagination);
  }

  /**
   * Xem chi tiết một bài viết của chính Blog Owner.
   *
   * GET /api/v1/blog-owner/posts/:id
   */
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.blogownerPostsService.findOne(user.id, postId);
  }

  /**
   * Tạo bài viết.
   *
   * POST /api/v1/blog-owner/posts
   * authorId = user đang đăng nhập
   *
   * - submitForReview = false / undefined
   *   -> DRAFT
   *
   * - submitForReview = true
   *   -> PENDING_REVIEW sau khi tạo/upload hoàn tất
   *
   * Blog Owner không được PUBLISH trực tiếp.
   */

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'thumbnail', maxCount: 1 },
        { name: 'thumbnailFile', maxCount: 1 },
        { name: 'media', maxCount: 10 },
        { name: 'files', maxCount: 10 },
        { name: 'file', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
        },
      },
    ),
  )
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBlogownerPostDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    const thumbnailFile = files?.thumbnail?.[0] || files?.thumbnailFile?.[0];
    const mediaFiles = [
      ...(files?.media || []),
      ...(files?.files || []),
      ...(files?.file || []),
    ].filter((f) => !thumbnailFile || f !== thumbnailFile);

    return this.blogownerPostsService.create(
      user.id,
      dto,
      thumbnailFile,
      mediaFiles.length > 0 ? mediaFiles : undefined,
    );
  }

  /**
   * Chỉnh sửa bài viết của chính Blog Owner.
   *
   * PATCH /api/v1/blog-owner/posts/:id
   */
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'thumbnail', maxCount: 1 },
        { name: 'thumbnailFile', maxCount: 1 },
        { name: 'media', maxCount: 10 },
        { name: 'files', maxCount: 10 },
        { name: 'file', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
        },
      },
    ),
  )
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) postId: number,
    @Body() dto: UpdateBlogownerPostDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    const thumbnailFile = files?.thumbnail?.[0] || files?.thumbnailFile?.[0];
    const mediaFiles = [
      ...(files?.media || []),
      ...(files?.files || []),
      ...(files?.file || []),
    ].filter((f) => !thumbnailFile || f !== thumbnailFile);

    return this.blogownerPostsService.update(
      user.id,
      postId,
      dto,
      thumbnailFile,
      mediaFiles.length > 0 ? mediaFiles : undefined,
    );
  }

  /**
   * Xóa mềm bài viết.
   *
   * DELETE /api/v1/blog-owner/posts/:id
   */
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.blogownerPostsService.remove(user.id, postId);
  }

  /**
   * Gửi bài sang Moderator để duyệt.
   *
   * POST /api/v1/blog-owner/posts/:id/submit
   */
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submitForReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.blogownerPostsService.submitForReview(user.id, postId);
  }

  /**
   * Dịch tự động title + content bằng Google.
   *
   * Chỉ trả preview, chưa lưu translation.
   *
   * POST /api/v1/blog-owner/posts/:id/translate-preview
   */
  @Post(':id/translate-preview')
  @HttpCode(HttpStatus.OK)
  translatePreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe)
    sourcePostId: number,
    @Body()
    dto: AutoTranslateBlogownerPostDto,
  ) {
    return this.blogownerPostsService.translatePreview(
      user.id,
      sourcePostId,
      dto,
    );
  }
}
