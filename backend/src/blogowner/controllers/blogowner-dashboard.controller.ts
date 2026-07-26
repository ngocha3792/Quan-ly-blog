import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from '@app/core';

import type { JwtPayload } from '@app/core';

import { BlogownerDashboardService } from '../services/blogowner-dashboard.service';

@Controller('blog-owner/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BLOG_OWNER)
export class BlogownerDashboardController {
  constructor(
    private readonly blogownerDashboardService:
      BlogownerDashboardService,
  ) {}

  /**
   * GET /api/v1/blog-owner/dashboard
   */
  @Get()
  getDashboard(
    @CurrentUser() user: JwtPayload,
  ) {
    return this.blogownerDashboardService.getDashboard(
      Number(user.id),
    );
  }
}