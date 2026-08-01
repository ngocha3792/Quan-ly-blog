import { Injectable } from '@nestjs/common';

import { PrismaService } from '@app/core';

@Injectable()
export class BlogownerOptionsService {
  constructor(private readonly prisma: PrismaService) {}

/**
 * Lấy dữ liệu lựa chọn cho form tạo/sửa bài viết:
 * - chỉ lấy ngôn ngữ đang hoạt động;
 * - chỉ lấy danh mục thuộc ngôn ngữ và nhóm đang hoạt động;
 * - chỉ lấy thẻ chưa bị soft-delete.
 */
  async getPostOptions() {
    const [languages, categories, tags] = await this.prisma.$transaction([
      this.prisma.language.findMany({
  where: {
    deletedAt: null,
    isActive: true,
  },

  select: {
    id: true,
    code: true,
    name: true,
    flag: true,
    isDefault: true,
    isActive: true,
  },

  /**
   * Đưa ngôn ngữ mặc định lên đầu,
   * sau đó sắp xếp các ngôn ngữ còn lại theo code.
   */
  orderBy: [
    {
      isDefault: 'desc',
    },
    {
      code: 'asc',
    },
  ],
}),

      this.prisma.category.findMany({
        where: {
          deletedAt: null,

          language: {
            deletedAt: null,
            isActive: true,
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
              isDefault: true,
              isActive: true,
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
