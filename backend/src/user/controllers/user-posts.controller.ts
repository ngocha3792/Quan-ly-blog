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
import type { AuthenticatedUser, PaginationParams } from '@app/core';
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
    @CurrentUser() user: AuthenticatedUser,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.postInteractionService.getBookmarkedPosts(
      user.id,
      pagination,
    );
  }

  @Get('likes')
  async getLikedPosts(
    @CurrentUser() user: AuthenticatedUser,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.postInteractionService.getLikedPosts(
      user.id,
      pagination,
    );
  }

  @Post(':id/bookmark')
  async bookmarkPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.postInteractionService.bookmarkPost(user.id, postId);
  }

  @Delete(':id/bookmark')
  async unbookmarkPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.postInteractionService.unbookmarkPost(user.id, postId);
  }

  @Post(':id/like')
  async likePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.postInteractionService.likePost(user.id, postId);
  }

  @Delete(':id/like')
  async unlikePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) postId: number,
  ) {
    return this.postInteractionService.unlikePost(user.id, postId);
  }
}
