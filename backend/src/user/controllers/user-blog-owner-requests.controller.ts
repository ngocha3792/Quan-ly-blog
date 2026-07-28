import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import {
  CreateBlogOwnerRequestDto,
  CurrentUser,
  GetBlogOwnerRequestsDto,
  JwtAuthGuard,
  Pagination,
  Roles,
  RolesGuard,
} from '@app/core';
import type { JwtPayload, PaginationParams } from '@app/core';

import { UserBlogOwnerRequestsService } from '../services/user-blog-owner-requests.service';

@Controller('user/blog-owner-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.NORMAL, UserRole.BLOG_OWNER)
@UseInterceptors(ClassSerializerInterceptor)
export class UserBlogOwnerRequestsController {
  constructor(
    private readonly userBlogOwnerRequestsService: UserBlogOwnerRequestsService,
  ) { }

  /**
   * Tạo yêu cầu xin trở thành tác giả blog.
   *
   * POST /api/v1/user/blog-owner-requests
   */
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBlogOwnerRequestDto,
  ) {
    return this.userBlogOwnerRequestsService.create(Number(user.id), dto);
  }

  /**
   * Lấy danh sách các yêu cầu xin trở thành tác giả của chính mình.
   *
   * GET /api/v1/user/blog-owner-requests
   */
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetBlogOwnerRequestsDto,
    @Pagination() paginationParams: PaginationParams,
  ) {
    return this.userBlogOwnerRequestsService.findAll(
      Number(user.id),
      query,
      paginationParams,
    );
  }

  /**
   * Xem chi tiết một yêu cầu cụ thể của mình.
   *
   * GET /api/v1/user/blog-owner-requests/:id
   */
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userBlogOwnerRequestsService.findOne(Number(user.id), id);
  }

  /**
   * Hủy yêu cầu xin làm tác giả (chỉ áp dụng cho trạng thái PENDING).
   *
   * DELETE /api/v1/user/blog-owner-requests/:id
   */
  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userBlogOwnerRequestsService.remove(Number(user.id), id);
  }
}
