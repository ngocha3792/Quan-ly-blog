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
import type { JwtPayload } from '@app/core';

import { CreateUserReportDto } from '../dto';
import { UserReportsService } from '../services/user-reports.service';

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
  reportPost(
    @CurrentUser() user: JwtPayload,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateUserReportDto,
  ) {
    return this.userReportsService.reportPost(
      Number(user.id),
      postId,
      dto,
    );
  }

  /**
   * POST /api/v1/user/comments/:commentId/reports
   */
  @Post('comments/:commentId/reports')
  reportComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: CreateUserReportDto,
  ) {
    return this.userReportsService.reportComment(
      Number(user.id),
      commentId,
      dto,
    );
  }
}