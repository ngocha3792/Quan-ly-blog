import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles, JwtAuthGuard, RolesGuard } from '@app/core';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  getDashboard() {
    return this.adminDashboardService.getDashboard();
  }
}
