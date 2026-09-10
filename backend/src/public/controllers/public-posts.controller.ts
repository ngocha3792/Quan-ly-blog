import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Public, GetPostsDto, LangCode } from '@app/core';
import type { PaginationParams } from '@app/core';
import { Pagination } from '@app/core/common/decorators';
import { PostsPublicService } from '../services/posts-public.service';

import { GetTopQueryDto, RecordPostViewDto } from '../dto';

@Controller('/posts')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicPostsController {
  constructor(private readonly postsPublicService: PostsPublicService) {}

  @Public()
  @Get()
  async findAll(
    @Query() query: GetPostsDto,
    @Pagination() paginationParams: PaginationParams,
    @LangCode() langCode: string | null,
  ) {
    return this.postsPublicService.findAll(query, paginationParams, langCode);
  }

  @Public()
  @Get('top')
  async getTopPosts(
    @Query() query: GetTopQueryDto,
    @LangCode() langCode: string | null,
  ) {
    return this.postsPublicService.getTopPosts(
      query.limit,
      query.langCode ?? langCode,
    );
  }

  @Public()
  @Post(':id/view')
  async recordView(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: RecordPostViewDto,

    @Headers('authorization')
    authorization?: string,
  ) {
    return this.postsPublicService.recordView(
      id,
      dto.visitorId,
      authorization || null,
    );
  }

  @Public()
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe)
    id: number,

    @LangCode()
    langCode: string | null,
  ) {
    return this.postsPublicService.findOne(id, langCode);
  }
}
