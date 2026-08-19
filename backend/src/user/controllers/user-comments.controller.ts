import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UpdateCommentDto,
} from '@app/core';
import type { AuthenticatedUser } from '@app/core';

import { CreateUserCommentDto } from '../dto';
import { UserCommentsService } from '../services/user-comments.service';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.NORMAL, UserRole.BLOG_OWNER)
@UseInterceptors(ClassSerializerInterceptor)
export class UserCommentsController {
  constructor(private readonly userCommentsService: UserCommentsService) {}

  /**
   * Tạo comment gốc hoặc reply.
   *
   * POST /api/v1/user/posts/:postId/comments
   */
  @Post('posts/:postId/comments')
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateUserCommentDto,
  ) {
    return this.userCommentsService.create(
      user.id,
      postId,
      dto,
    );
  }

  /**
   * Chỉ sửa nội dung comment của chính mình.
   *
   * PATCH /api/v1/user/comments/:commentId
   */
  @Patch('comments/:commentId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.userCommentsService.update(
      commentId,
      user.id,
      dto,
    );
  }

  /**
   * Xóa mềm comment của chính mình.
   *
   * DELETE /api/v1/user/comments/:commentId
   */
  @Delete('comments/:commentId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.userCommentsService.remove(
      commentId,
      user.id,
    );
  }
}