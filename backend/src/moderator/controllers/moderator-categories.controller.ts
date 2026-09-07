import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import {
  GetCategoryGroupsDto,
  JwtAuthGuard,
  Pagination,
  Roles,
  RolesGuard,
} from '@app/core';
import type { PaginationParams } from '@app/core';

import {
  CreateCategoryGroupTranslationsDto,
  TranslateCategoryPreviewDto,
  UpdateCategoryGroupTranslationsDto,
} from '../dto';
import { ModeratorCategoriesService } from '../services/moderator-categories.service';

@Controller('moderator/category-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTENT_MODERATOR)
@UseInterceptors(ClassSerializerInterceptor)
export class ModeratorCategoriesController {
  constructor(
    private readonly moderatorCategoriesService: ModeratorCategoriesService,
  ) {}

  /**
   * Danh sách CategoryGroup và các bản dịch.
   *
   * GET /api/v1/moderator/category-groups
   */
  @Get()
  findAll(
    @Query() query: GetCategoryGroupsDto,
    @Pagination() pagination: PaginationParams,
  ) {
    return this.moderatorCategoriesService.findAll(query, pagination);
  }

  /**
   * Chi tiết một CategoryGroup.
   *
   * GET /api/v1/moderator/category-groups/:groupId
   */
  @Get(':groupId')
  findOne(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.moderatorCategoriesService.findOne(groupId);
  }

  /**
   * Dịch tên category sang các ngôn ngữ đích để Moderator xem trước.
   *
   * Không ghi dữ liệu vào database.
   *
   * POST /api/v1/moderator/category-groups/translate-preview
   */
    @Post('translate-preview')
    @HttpCode(HttpStatus.OK)
    translatePreview(@Body() dto: TranslateCategoryPreviewDto) {
      return this.moderatorCategoriesService.translatePreview(dto);
    }

  /**
   * Tạo CategoryGroup cùng nhiều bản dịch.
   *
   * POST /api/v1/moderator/category-groups
   */
  @Post()
  create(@Body() dto: CreateCategoryGroupTranslationsDto) {
    return this.moderatorCategoriesService.create(dto);
  }

  /**
   * Cập nhật code hoặc upsert các bản dịch.
   *
   * PATCH /api/v1/moderator/category-groups/:groupId
   */
  @Patch(':groupId')
  update(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: UpdateCategoryGroupTranslationsDto,
  ) {
    return this.moderatorCategoriesService.update(groupId, dto);
  }

/**
 * Xóa mềm một bản dịch khỏi CategoryGroup.
 *
 * DELETE /api/v1/moderator/category-groups/:groupId/translations/:languageId
 */
@Delete(':groupId/translations/:languageId')
removeTranslation(
  @Param('groupId', ParseIntPipe) groupId: number,
  @Param('languageId', ParseIntPipe) languageId: number,
) {
  return this.moderatorCategoriesService.removeTranslation(
    groupId,
    languageId,
  );
}

  /**
   * Xóa mềm group và các bản dịch.
   *
   * DELETE /api/v1/moderator/category-groups/:groupId
   */
  @Delete(':groupId')
  remove(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.moderatorCategoriesService.remove(groupId);
  }
}
