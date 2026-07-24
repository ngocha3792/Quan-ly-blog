import { Controller, Get, Param, ParseIntPipe, UseInterceptors, ClassSerializerInterceptor, Query } from '@nestjs/common';
import { Public, GetPostsDto, LangCode } from '@app/core';
import type { PaginationParams } from '@app/core';
import { Pagination } from '@app/core/common/decorators';
import { UsersPublicService } from '../services/users-public.service';

@Controller('/authors')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicAuthorsController {
    constructor(private readonly usersPublicService: UsersPublicService) {}

    @Public()
    @Get(':id')
    async getAuthorInfo(
        @Param('id', ParseIntPipe) id: number,
        @Query() query: GetPostsDto,
        @Pagination() paginationParams: PaginationParams,
        @LangCode() langCode: string | null,
    ) {
        return this.usersPublicService.getAuthorInfo(id, query, paginationParams, langCode);
    }
}
