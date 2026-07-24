import { Controller, Get, Query, Param, ParseIntPipe, UseInterceptors, ClassSerializerInterceptor, Headers } from '@nestjs/common';
import { Public, GetPostsDto } from '@app/core';
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
        @Headers('accept-language') acceptLanguage?: string,
        @Query('lang') lang?: string,
    ) {
        const langCode = lang || (acceptLanguage ? acceptLanguage.split(',')[0].split('-')[0].trim() : null);
        return this.postsPublicService.findAll(query, paginationParams, langCode);
    }

    @Public()
    @Get('top')
    async getTopPosts(
        @Query('limit') limit: number = 10,
        @Headers('accept-language') acceptLanguage?: string,
        @Query('lang') lang?: string,
    ) {
        const langCode = lang || (acceptLanguage ? acceptLanguage.split(',')[0].split('-')[0].trim() : null);
        return this.postsPublicService.getTopPosts(Number(limit), langCode);
    }

    @Public()
    @Get(':id')
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @Headers('accept-language') acceptLanguage?: string,
        @Query('lang') lang?: string,
    ) {
        const langCode = lang || (acceptLanguage ? acceptLanguage.split(',')[0].split('-')[0].trim() : null);
        return this.postsPublicService.findOne(id, langCode);
    }
}
