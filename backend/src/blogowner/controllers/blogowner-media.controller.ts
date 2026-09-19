/// <reference types="multer" />

import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/core';
import type { AuthenticatedUser } from '@app/core';

import { BlogownerMediaService } from '../services/blogowner-media.service';

@Controller('blog-owner/posts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BLOG_OWNER)
export class BlogownerMediaController {
  constructor(private readonly blogownerMediaService: BlogownerMediaService) {}

  /**
   * Upload ảnh hoặc video cho bài viết.
   *
   * POST /api/v1/blog-owner/posts/:postId/media
   */
  @Post(':postId/media')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseIntPipe) postId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.blogownerMediaService.upload(user.id, postId, file);
  }

  /**
   * Upload ảnh chèn vào nội dung bài viết (nút "image" trên Quill).
   *
   * Không cần :postId — dùng được cả lúc đang soạn bài MỚI (bài chưa
   * có id). Trả về { url } để frontend tự insertEmbed vào editor.
   *
   * POST /api/v1/blog-owner/posts/content-image
   */
  @Post('content-image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadContentImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.blogownerMediaService.uploadContentImage(file);
  }

  /**
   * Xóa media khỏi bài viết.
   *
   * DELETE /api/v1/blog-owner/posts/:postId/media/:mediaId
   */
  @Delete(':postId/media/:mediaId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
  ) {
    return this.blogownerMediaService.remove(user.id, postId, mediaId);
  }
}
