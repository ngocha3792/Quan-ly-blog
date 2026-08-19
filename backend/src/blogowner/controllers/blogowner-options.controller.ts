import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard, Roles, RolesGuard } from '@app/core';

import { BlogownerOptionsService } from '../services/blogowner-options.service';

@Controller('blog-owner/options')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BLOG_OWNER)
export class BlogownerOptionsController {
  constructor(
    private readonly blogownerOptionsService: BlogownerOptionsService,
  ) {}

  /**
   * GET /api/v1/blog-owner/options
   */
  @Get()
  getPostOptions() {
    return this.blogownerOptionsService.getPostOptions();
  }
}
