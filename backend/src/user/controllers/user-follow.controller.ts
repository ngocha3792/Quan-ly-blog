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
import { UserFollowService } from '../services/user-follow.service';

@Controller('user/follow')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserFollowController {
  constructor(private readonly userFollowService: UserFollowService) {}

  @Get('followers')
  async getMyFollowers(
    @CurrentUser() user: JwtPayload,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.userFollowService.getFollowers(Number(user.id), pagination);
  }

  @Get('following')
  async getMyFollowing(
    @CurrentUser() user: JwtPayload,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.userFollowService.getFollowing(Number(user.id), pagination);
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
  async followUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) followingId: number,
  ) {
    return this.userFollowService.followUser(Number(user.id), followingId);
  }

  @Delete(':id')
  async unfollowUser(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) followingId: number,
  ) {
    return this.userFollowService.unfollowUser(Number(user.id), followingId);
  }
}
