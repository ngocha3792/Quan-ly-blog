import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  GetBlogOwnerRequestsDto,
  Pagination,
  Roles,
  CurrentUser,
  JwtAuthGuard,
  RolesGuard,
} from '@app/core';
import type { AuthenticatedUser, PaginationParams } from '@app/core';
import { AdminRequestsService } from '../services/admin-requests.service';
import { ReviewBlogOwnerRequestDto } from '../dto';

@Controller('admin/requests/blog-owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminRequestsController {
  constructor(private readonly adminRequestsService: AdminRequestsService) { }

  @Roles(UserRole.SUPER_ADMIN,UserRole.CONTENT_MODERATOR)
  @Get()
  findAll(
    @Query() query: GetBlogOwnerRequestsDto,
    @Pagination() paginationParams: PaginationParams,
  ) {
    return this.adminRequestsService.findAllRequests(query, paginationParams);
  }

  @Roles(UserRole.SUPER_ADMIN,UserRole.CONTENT_MODERATOR)
  @Patch(':id')
  reviewRequest(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() adminUser: AuthenticatedUser,
    @Body() reviewDto: ReviewBlogOwnerRequestDto,
  ) {
    return this.adminRequestsService.reviewRequest(id, adminUser.id, reviewDto);
  }
}
