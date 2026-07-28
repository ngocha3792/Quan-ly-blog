import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  CurrentUser,
  Pagination,
} from '@app/core';
import type { JwtPayload, PaginationParams } from '@app/core';
import { PostInteractionService } from '../services/post-interaction.service';

@Controller('user/posts')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserPostsController {
  constructor(
    private readonly postInteractionService: PostInteractionService,
  ) {}

  @Get('bookmarks')
  async getBookmarkedPosts(
    @CurrentUser() user: JwtPayload,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.postInteractionService.getBookmarkedPosts(
      Number(user.id),
      pagination,
    );
  }

  @Get('likes')
  async getLikedPosts(
    @CurrentUser() user: JwtPayload,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.postInteractionService.getLikedPosts(
      Number(user.id),
      pagination,
    );
  }

  @Post(':id/bookmark')
  async bookmarkPost(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.postInteractionService.bookmarkPost(Number(user.id), postId);
  }

  @Delete(':id/bookmark')
  async unbookmarkPost(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.postInteractionService.unbookmarkPost(Number(user.id), postId);
  }

  @Post(':id/like')
  async likePost(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.postInteractionService.likePost(Number(user.id), postId);
  }

  @Delete(':id/like')
  async unlikePost(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.postInteractionService.unlikePost(Number(user.id), postId);
  }
}
