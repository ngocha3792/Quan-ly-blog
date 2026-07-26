import { Injectable } from '@nestjs/common';

import { PrismaService } from '@app/core';

@Injectable()
export class BlogownerOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy toàn bộ dữ liệu cần thiết cho form tạo/sửa bài:
   * - ngôn ngữ;
   * - danh mục;
   * - thẻ.
   */
  async getPostOptions() {
    const [languages, categories, tags] = await this.prisma.$transaction([
      this.prisma.language.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          code: true,
          name: true,
          flag: true,
        },
        orderBy: {
          code: 'asc',
        },
      }),

      this.prisma.category.findMany({
        where: {
          deletedAt: null,

          language: {
            deletedAt: null,
          },

          categoryGroup: {
            deletedAt: null,
          },
        },

        select: {
          id: true,
          name: true,
          languageId: true,
          categoryGroupId: true,

          language: {
            select: {
              id: true,
              code: true,
              name: true,
              flag: true,
            },
          },

          categoryGroup: {
            select: {
              id: true,
              code: true,
            },
          },
        },

        orderBy: [
          {
            languageId: 'asc',
          },
          {
            name: 'asc',
          },
        ],
      }),

      this.prisma.tag.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    return {
      languages,
      categories,
      tags,
    };
  }
}
