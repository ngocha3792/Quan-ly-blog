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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  CurrentUser,
  Pagination,
} from '@app/core';
import type { AuthenticatedUser, PaginationParams } from '@app/core';
import { UserFollowService } from '../services/user-follow.service';

@Controller('user/follow')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserFollowController {
  constructor(private readonly userFollowService: UserFollowService) {}

  @Get('followers')
  async getMyFollowers(
    @CurrentUser() user: AuthenticatedUser,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.userFollowService.getFollowers(user.id, pagination);
  }

  @Get('following')
  async getMyFollowing(
    @CurrentUser() user: AuthenticatedUser,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.userFollowService.getFollowing(user.id, pagination);
  }

  @Get(':id/followers')
  async getUserFollowers(
    @Param('id', ParseIntPipe) id: number,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.userFollowService.getFollowers(id, pagination);
  }

  @Get(':id/following')
  async getUserFollowing(
    @Param('id', ParseIntPipe) id: number,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.userFollowService.getFollowing(id, pagination);
  }

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async followUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) followingId: number,
  ) {
    return this.userFollowService.followUser(user.id, followingId);
  }

  @Delete(':id')
  async unfollowUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) followingId: number,
  ) {
    return this.userFollowService.unfollowUser(user.id, followingId);
  }
}
