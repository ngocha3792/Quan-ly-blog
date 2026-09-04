import {
  Controller,
  Get,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Public, SearchPostsDto, LangCode } from '@app/core';
import type { PaginationParams } from '@app/core';
import { Pagination } from '@app/core/common/decorators';
import { PublicSearchService } from '../services/public-search.service';

@Controller('/search')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicSearchController {
  constructor(private readonly publicSearchService: PublicSearchService) {}

  @Public()
  @Get('posts')
  async searchPosts(
    @Query() query: SearchPostsDto,
    @Pagination() paginationParams: PaginationParams,
    @LangCode() langCode: string | null,
  ) {
    return this.publicSearchService.search(query, paginationParams, langCode);
  }
}
