import { Controller, Get, Query, Param, ParseIntPipe, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { Public, GetPostsDto, LangCode } from '@app/core';
import type { PaginationParams } from '@app/core';
import { Pagination } from '@app/core/common/decorators';
import { PostsPublicService } from '../services/posts-public.service';

@Controller('/posts')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicPostsController {
    constructor(private readonly postsPublicService: PostsPublicService) { }

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
        @Query('limit') limit: number = 10,
        @LangCode() langCode: string | null,
    ) {
        return this.postsPublicService.getTopPosts(Number(limit), langCode);
    }

    @Public()
    @Get(':id')
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @LangCode() langCode: string | null,
    ) {
        return this.postsPublicService.findOne(id, langCode);
    }
}
