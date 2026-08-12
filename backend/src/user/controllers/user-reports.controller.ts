import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from '@app/core';
import type { AuthenticatedUser } from '@app/core';

import { CreateUserReportDto } from '../dto';
import { UserReportsService } from '../services/user-reports.service';
import { UserReportEntity } from '../entities';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.NORMAL, UserRole.BLOG_OWNER)
@UseInterceptors(ClassSerializerInterceptor)
export class UserReportsController {
  constructor(
    private readonly userReportsService: UserReportsService,
  ) {}

  /**
   * POST /api/v1/user/posts/:postId/reports
   */
  @Post('posts/:postId/reports')
  async reportPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateUserReportDto,
  ) {
    const report = await this.userReportsService.reportPost(
      user.id,
      postId,
      dto,
    );
    return new UserReportEntity(report);
  }

  /**
   * POST /api/v1/user/comments/:commentId/reports
   */
  @Post('comments/:commentId/reports')
  async reportComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: CreateUserReportDto,
  ) {
    const report = await this.userReportsService.reportComment(
      user.id,
      commentId,
      dto,
    );
    return new UserReportEntity(report);
  }
}