import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard, Roles, RolesGuard } from '@app/core';

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
  /**
   * Tổng quan nhanh cho các card trên dashboard.
   *
   * GET /api/v1/moderator/dashboard/overview
   */
  @Get('overview')
  getOverview() {
    return this.moderatorDashboardService.getOverview();
  }

  /**
   * Thống kê báo cáo theo trạng thái và lý do.
   *
   * GET /api/v1/moderator/dashboard/report-stats
   */
  @Get('report-stats')
  getReportStats() {
    return this.moderatorDashboardService.getReportStats();
  }

  /**
   * Xu hướng báo cáo trong 7 ngày gần nhất.
   *
   * GET /api/v1/moderator/dashboard/report-trend
   */
  @Get('report-trend')
  getReportTrend() {
    return this.moderatorDashboardService.getReportTrend();
  }
}
