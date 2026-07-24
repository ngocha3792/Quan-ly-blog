import { Controller, Get, Query, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { Public, GetTagsDto, Pagination, LangCode } from '@app/core';
import { TagsPublicService } from '../services/tags-public.service';
import type { PaginationParams } from '@app/core';

@Controller('/tags')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicTagsController {
    constructor(private readonly tagsPublicService: TagsPublicService) { }

    @Public()
    @Get('top')
    async getTopTags(
        @Query('limit') limit: number = 10,
        @LangCode() langCode: string | null,
    ) {
        return this.tagsPublicService.getTopTags(Number(limit), langCode);
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
