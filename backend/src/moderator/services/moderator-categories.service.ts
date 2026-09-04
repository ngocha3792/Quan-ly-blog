import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CategoryGroupNotFoundException, PrismaService } from '@app/core';
import type {
  GetCategoryGroupsDto,
  PaginatedResult,
  PaginationParams,
} from '@app/core';

import type {
  CreateCategoryGroupTranslationsDto,
  UpdateCategoryGroupTranslationsDto,
} from '../dto';
import { ModeratorCategoryGroupEntity } from '../entities';
import { ModeratorCategoriesValidator } from '../validators/moderator-categories.validator';

/**
 * Các quan hệ cần trả cho màn hình Moderator.
 *
 * Chỉ lấy các bản dịch chưa bị xóa mềm.
 */
const MODERATOR_CATEGORY_GROUP_INCLUDE = {
  categories: {
    where: {
      deletedAt: null,
    },

    include: {
      language: true,
    },

    orderBy: {
      languageId: 'asc',
    },
  },
} satisfies Prisma.CategoryGroupInclude;

@Injectable()
export class ModeratorCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: ModeratorCategoriesValidator,
  ) {}

  /**
   * Danh sách các nhóm danh mục.
   *
   * Tìm kiếm theo:
   * - code của CategoryGroup;
   * - tên của bất kỳ bản dịch nào.
   */
  async findAll(
    query: GetCategoryGroupsDto,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ModeratorCategoryGroupEntity>> {
    const { skip, take, page } = pagination;

    const search = query.search?.trim();

    const where: Prisma.CategoryGroupWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        {
          code: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          categories: {
            some: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
              deletedAt: null,
            },
          },
        },
      ];
    }

    const [groups, totalItems] = await Promise.all([
      this.prisma.categoryGroup.findMany({
        where,
        skip,
        take,

        orderBy: {
          code: 'asc',
        },

        include: MODERATOR_CATEGORY_GROUP_INCLUDE,
      }),

      this.prisma.categoryGroup.count({
        where,
      }),
    ]);

    return {
      items: groups.map((group) => new ModeratorCategoryGroupEntity(group)),

      meta: {
        totalItems,
        itemCount: groups.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take),
        currentPage: page,
      },
    };
  }

  /**
   * Xem chi tiết một CategoryGroup.
   */
  async findOne(groupId: number): Promise<ModeratorCategoryGroupEntity> {
    const group = await this.prisma.categoryGroup.findFirst({
      where: {
        id: groupId,
        deletedAt: null,
      },

      include: MODERATOR_CATEGORY_GROUP_INCLUDE,
    });

    if (!group) {
      throw new CategoryGroupNotFoundException(groupId);
    }

    return new ModeratorCategoryGroupEntity(group);
  }

  /**
   * Tạo CategoryGroup cùng toàn bộ bản dịch.
   *
   * Ví dụ:
   * CategoryGroup: programming
   *
   * Categories:
   * - Lập trình
   * - Programming
   * - プログラミング
   */
  async create(
    dto: CreateCategoryGroupTranslationsDto,
  ): Promise<ModeratorCategoryGroupEntity> {
    const code = dto.code;
    const translations = dto.translations;

    await this.validator.ensureCodeAvailable(code);

    await this.validator.ensureActiveLanguages(
      translations.map((translation) => translation.languageId),
    );

    await this.validator.ensureTranslationNamesAvailable(translations);

    const createdGroup = await this.prisma.$transaction(async (tx) =>
      tx.categoryGroup.create({
        data: {
          code,

          categories: {
            create: translations.map((translation) => ({
              languageId: translation.languageId,
              name: translation.name,
            })),
          },
        },

        include: MODERATOR_CATEGORY_GROUP_INCLUDE,
      }),
    );

    return new ModeratorCategoryGroupEntity(createdGroup);
  }

  /**
   * Cập nhật CategoryGroup.
   *
   * translations hoạt động theo kiểu upsert:
   *
   * - Đã tồn tại languageId:
   *   cập nhật tên.
   *
   * - Chưa tồn tại languageId:
   *   tạo bản dịch mới.
   *
   * - Bản dịch đã bị soft delete:
   *   khôi phục và cập nhật tên.
   *
   * - Bản dịch không xuất hiện trong request:
   *   giữ nguyên.
   */
  async update(
    groupId: number,
    dto: UpdateCategoryGroupTranslationsDto,
  ): Promise<ModeratorCategoryGroupEntity> {
    if (dto.code === undefined && dto.translations === undefined) {
      throw new BadRequestException(
        'Phải cung cấp code hoặc danh sách bản dịch cần cập nhật.',
      );
    }

    await this.validator.ensureActiveGroupExists(groupId);

    const code = dto.code;
    const translations = dto.translations;

    if (translations !== undefined && translations.length === 0) {
      throw new BadRequestException('Danh sách bản dịch không được để trống.');
    }

    if (code !== undefined) {
      await this.validator.ensureCodeAvailable(code, groupId);
    }

    if (translations !== undefined) {
      await this.validator.ensureActiveLanguages(
        translations.map((translation) => translation.languageId),
      );

      await this.validator.ensureTranslationNamesAvailable(
        translations,
        groupId,
      );
    }

    const updatedGroup = await this.prisma.$transaction(async (tx) => {
      /**
       * Luôn cập nhật group một lần.
       *
       * Khi chỉ đổi translations, updatedAt của group
       * vẫn được cập nhật để phản ánh thay đổi mới nhất.
       */
      await tx.categoryGroup.update({
        where: {
          id: groupId,
        },

        data:
          code === undefined
            ? {
                updatedAt: new Date(),
              }
            : {
                code,
              },
      });

      if (translations !== undefined) {
        for (const translation of translations) {
          await tx.category.upsert({
            where: {
              categoryGroupId_languageId: {
                categoryGroupId: groupId,
                languageId: translation.languageId,
              },
            },

            update: {
              name: translation.name,

              /**
               * Bản dịch đã bị xóa mềm sẽ được khôi phục.
               */
              deletedAt: null,
            },

            create: {
              categoryGroupId: groupId,
              languageId: translation.languageId,
              name: translation.name,
            },
          });
        }
      }

      const group = await tx.categoryGroup.findUnique({
        where: {
          id: groupId,
        },

        include: MODERATOR_CATEGORY_GROUP_INCLUDE,
      });

      if (!group) {
        throw new CategoryGroupNotFoundException(groupId);
      }

      return group;
    });

    return new ModeratorCategoryGroupEntity(updatedGroup);
  }

  /**
   * Xóa mềm CategoryGroup và toàn bộ bản dịch.
   *
   * Không cho xóa nếu có bài viết đang sử dụng
   * bất kỳ category nào thuộc group.
   */
  async remove(groupId: number): Promise<ModeratorCategoryGroupEntity> {
    await this.validator.ensureActiveGroupExists(groupId);

    const usageCount = await this.prisma.postCategory.count({
      where: {
        category: {
          categoryGroupId: groupId,
        },
      },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        `Không thể xóa nhóm danh mục vì đang có ${usageCount} liên kết bài viết sử dụng nhóm này.`,
      );
    }

    const deletedAt = new Date();

    const deletedGroup = await this.prisma.$transaction(async (tx) => {
      /**
       * Xóa mềm toàn bộ bản dịch trước.
       */
      await tx.category.updateMany({
        where: {
          categoryGroupId: groupId,
          deletedAt: null,
        },

        data: {
          deletedAt,
        },
      });

      /**
       * Sau đó xóa mềm group.
       */
      return tx.categoryGroup.update({
        where: {
          id: groupId,
        },

        data: {
          deletedAt,
        },

        include: MODERATOR_CATEGORY_GROUP_INCLUDE,
      });
    });
    return new ModeratorCategoryGroupEntity(deletedGroup);
  }
}
