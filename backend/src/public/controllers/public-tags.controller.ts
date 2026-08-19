import {
  Controller,
  Get,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Public, GetTagsDto, Pagination, LangCode } from '@app/core';
import { TagsPublicService } from '../services/tags-public.service';
import type { PaginationParams } from '@app/core';

import { GetTopQueryDto } from '../dto';

@Controller('/tags')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicTagsController {
  constructor(private readonly tagsPublicService: TagsPublicService) {}

  @Public()
  @Get('top')
  async getTopTags(
    @Query() query: GetTopQueryDto,
    @LangCode() langCode: string | null,
  ) {
    return this.tagsPublicService.getTopTags(
      query.limit,
      query.langCode ?? langCode,
    );
  }

  @Public()
  @Get()
  async findAll(
    @Query() query: GetTagsDto,
    @Pagination() paginationParams: PaginationParams,
  ) {
    return this.tagsPublicService.findAll(query, paginationParams);
  }
}
