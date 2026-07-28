import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import {
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from '@app/core';

import { ModeratorDashboardService } from '../services/moderator-dashboard.service';

@Controller('moderator/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTENT_MODERATOR)
export class ModeratorDashboardController {
  constructor(
    private readonly moderatorDashboardService: ModeratorDashboardService,
  ) {}

  /**
   * Thống kê tổng quan dành cho Moderator.
   *
   * GET /api/v1/moderator/dashboard
   */
  @Get()
  getDashboard() {
    return this.moderatorDashboardService.getDashboard();
  }
}