import { Controller, Get, Query, UseInterceptors, ClassSerializerInterceptor, Headers } from '@nestjs/common';
import { Public, GetCategoriesDto } from '@app/core';
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
        @Headers('accept-language') acceptLanguage?: string,
        @Query('lang') lang?: string,
    ) {
        const langCode = lang || (acceptLanguage ? acceptLanguage.split(',')[0].split('-')[0].trim() : null);
        return this.categoriesPublicService.findAll(query, paginationParams, langCode);
    }
}
