import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import {
  CurrentUser,
  JwtAuthGuard,
  Pagination,
  Roles,
  RolesGuard,
} from '@app/core';
import type {
  AuthenticatedUser,
  PaginationParams,
} from '@app/core';

import {
  GetModeratorReportsDto,
  RejectModeratorReportDto,
  ResolveModeratorReportDto,
} from '../dto';
import { ModeratorReportsService } from '../services/moderator-reports.service';

@Controller('moderator/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTENT_MODERATOR)
@UseInterceptors(ClassSerializerInterceptor)
export class ModeratorReportsController {
  constructor(
    private readonly moderatorReportsService: ModeratorReportsService,
  ) {}

  /**
   * Danh sách báo cáo.
   *
   * Mặc định chỉ lấy report PENDING.
   *
   * GET /api/v1/moderator/reports
   */
  @Get()
  findAll(
    @Query() query: GetModeratorReportsDto,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.moderatorReportsService.findAll(
      query,
      pagination,
    );
  }

  /**
   * Xem chi tiết một báo cáo.
   *
   * GET /api/v1/moderator/reports/:reportId
   */
  @Get(':reportId')
  findOne(
    @Param('reportId', ParseIntPipe) reportId: number,
  ) {
    return this.moderatorReportsService.findOne(reportId);
  }

  /**
   * Xác nhận report đúng:
   * - Report chuyển RESOLVED.
   * - Post hoặc Comment bị ẩn.
   *
   * POST /api/v1/moderator/reports/:reportId/resolve
   */
  @Post(':reportId/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentUser() moderator: AuthenticatedUser,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() dto: ResolveModeratorReportDto,
  ) {
    return this.moderatorReportsService.resolve(
      moderator.id,
      reportId,
      dto,
    );
  }

  /**
   * Bác bỏ report:
   * - Report chuyển REJECTED.
   * - Nội dung không bị ảnh hưởng.
   *
   * POST /api/v1/moderator/reports/:reportId/reject
   */
  @Post(':reportId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() moderator: AuthenticatedUser,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() dto: RejectModeratorReportDto,
  ) {
    return this.moderatorReportsService.reject(
      moderator.id,
      reportId,
      dto,
    );
  }
}