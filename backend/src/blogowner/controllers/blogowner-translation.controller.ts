import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import {
  UserRole,
} from '@prisma/client';

import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from '@app/core';

import type {
  AuthenticatedUser,
} from '@app/core';

import {
  BlogownerTranslationStatusService,
} from '../queues';

@Controller(
  'blog-owner/translation-batches',
)
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles(UserRole.BLOG_OWNER)
export class BlogownerTranslationController {
  constructor(
    private readonly translationStatusService:
      BlogownerTranslationStatusService,
  ) {}

  /**
   * GET
   * /api/v1/blog-owner/translation-batches/:batchId
   */
  @Get(':batchId')
  getBatchStatus(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param('batchId')
    batchId: string,
  ) {
    return this.translationStatusService.getBatchStatus(
      user.id,
      batchId,
    );
  }
}