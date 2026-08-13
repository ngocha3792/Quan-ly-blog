import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CategoriesService,
  GetCategoriesDto,
  LanguagesService,
} from '@app/core';
import type { PaginationParams } from '@app/core';

const PUBLIC_CATEGORY_WHERE = {
  language: {
    is: {
      isActive: true,
      deletedAt: null,
    },
  },
  categoryGroup: {
    is: {
      deletedAt: null,
    },
  },
} satisfies Prisma.CategoryWhereInput;

@Injectable()
export class CategoriesPublicService {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly languagesService: LanguagesService,
  ) {}

  async findAll(
    query: GetCategoriesDto,
    paginationParams: PaginationParams,
    langCode: string | null,
  ) {
    if (!query.languageId && langCode) {
      const languageId =
        await this.languagesService.getActiveIdByCode(langCode);

      if (!languageId) {
        return {
          items: [],
          meta: {
            totalItems: 0,
            itemCount: 0,
            itemsPerPage: paginationParams.take,
            totalPages: 0,
            currentPage: paginationParams.page,
          },
        };
      }

      query.languageId = languageId;
    }

    return this.categoriesService.findAll(
      query,
      paginationParams,
      {
        language: true,
      },
      PUBLIC_CATEGORY_WHERE,
    );
  }
}
