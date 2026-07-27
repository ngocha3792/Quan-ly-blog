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

import {
  CommentsService,
  CreateCommentDto,
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UpdateCommentDto,
} from '@app/core';
import type { JwtPayload } from '@app/core';

import { CreateUserCommentDto } from '../dto';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.NORMAL, UserRole.BLOG_OWNER)
@UseInterceptors(ClassSerializerInterceptor)
export class UserCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Tạo comment gốc hoặc reply.
   *
   * POST /api/v1/user/posts/:postId/comments
   */
  @Post('posts/:postId/comments')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateUserCommentDto,
  ) {
    const createCommentDto: CreateCommentDto = {
      ...dto,
      postId,
    };

    return this.commentsService.create(
      Number(user.id),
      createCommentDto,
    );
  }

  /**
   * Chỉ sửa nội dung comment của chính mình.
   *
   * PATCH /api/v1/user/comments/:commentId
   */
  @Patch('comments/:commentId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(
      commentId,
      Number(user.id),
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
    @CurrentUser() user: JwtPayload,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.commentsService.remove(
      commentId,
      Number(user.id),
    );
  }
}