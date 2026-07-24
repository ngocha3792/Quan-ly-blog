import { Controller, Get, Query, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { Public, GetCategoriesDto, LangCode } from '@app/core';
import type { PaginationParams } from '@app/core';
import { Pagination } from '@app/core/common/decorators';
import { CategoriesPublicService } from '../services/categories-public.service';

@Controller('/categories')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicCategoriesController {
    constructor(private readonly categoriesPublicService: CategoriesPublicService) { }

    @Public()
    @Get()
    async findAll(
        @Query() query: GetCategoriesDto,
        @Pagination() paginationParams: PaginationParams,
        @LangCode() langCode: string | null,
    ) {
        return this.categoriesPublicService.findAll(query, paginationParams, langCode);
    }
}
