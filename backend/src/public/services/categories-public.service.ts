import { Injectable } from '@nestjs/common';
import { CategoriesService, GetCategoriesDto, LanguagesService } from '@app/core';
import type { PaginationParams } from '@app/core';

@Injectable()
export class CategoriesPublicService {
    constructor(
        private readonly categoriesService: CategoriesService,
        private readonly languagesService: LanguagesService,
    ) {}

    async findAll(query: GetCategoriesDto, paginationParams: PaginationParams, langCode: string | null) {
        if (!query.languageId && langCode) {
            const languageId = await this.languagesService.getIdByCode(langCode);
            if (languageId) {
                query.languageId = languageId;
            }
        }

        return this.categoriesService.findAll(query, paginationParams, { language: true });
    }
}
