import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from '@app/core';
import type { AuthenticatedUser } from '@app/core';

import {
  GetBlogownerDashboardActivityDto,
  GetBlogownerDashboardFeaturedDto,
} from '../dto';
import { BlogownerDashboardService } from '../services/blogowner-dashboard.service';

@Controller('blog-owner/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BLOG_OWNER)
export class BlogownerDashboardController {
  constructor(
    private readonly blogownerDashboardService: BlogownerDashboardService,
  ) {}

  /**
   * Tổng quan nhanh:
   * - số bài theo trạng thái;
   * - tổng view;
   * - tổng like;
   * - tổng comment.
   *
   * GET /api/v1/blog-owner/dashboard/summary
   */
  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.blogownerDashboardService.getSummary(user.id);
  }

  /**
   * Biến động interaction theo ngày.
   *
   * GET /api/v1/blog-owner/dashboard/activity?days=7
   */
  @Get('activity')
  getActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetBlogownerDashboardActivityDto,
  ) {
    return this.blogownerDashboardService.getActivity(
      user.id,
      query.days,
    );
  }

  /**
   * Bài viết nổi bật.
   *
   * Mỗi exact Post cạnh tranh độc lập:
   * root và translation đều có thể xuất hiện.
   *
   * GET /api/v1/blog-owner/dashboard/featured?sort=views&limit=5
   */
  @Get('featured')
  getFeatured(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetBlogownerDashboardFeaturedDto,
  ) {
    return this.blogownerDashboardService.getFeatured(
      user.id,
      query.sort,
      query.limit,
    );
  }

  /**
   * Legacy endpoint.
   *
   * Giữ lại tạm thời để FE cũ không bị vỡ
   * trong quá trình migrate sang các API tách nhỏ.
   *
   * GET /api/v1/blog-owner/dashboard
   */
  @Get()
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.blogownerDashboardService.getDashboard(user.id);
  }
}