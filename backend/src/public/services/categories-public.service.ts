import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CategoriesService, GetCategoriesDto } from '@app/core';
import type { PaginationParams } from '@app/core';

@Injectable()
export class CategoriesPublicService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly categoriesService: CategoriesService,
    ) {}

    private async getLanguageIdByCode(langCode: string | null): Promise<number | undefined> {
        if (!langCode) return undefined;
        const language = await this.prisma.language.findUnique({
            where: { code: langCode }
        });
        return language?.id;
    }

    async findAll(query: GetCategoriesDto, paginationParams: PaginationParams, langCode: string | null) {
        if (!query.languageId && langCode) {
            const languageId = await this.getLanguageIdByCode(langCode);
            if (languageId) {
                query.languageId = languageId;
            }
        }

        return this.categoriesService.findAll(query, paginationParams, { language: true });
    }
}
