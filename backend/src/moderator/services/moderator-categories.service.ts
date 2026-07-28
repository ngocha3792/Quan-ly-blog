import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  CategoryGroupNotFoundException,
  PrismaService,
} from '@app/core';
import type {
  GetCategoryGroupsDto,
  PaginatedResult,
  PaginationParams,
} from '@app/core';

import type {
  CategoryGroupTranslationDto,
  CreateCategoryGroupTranslationsDto,
  UpdateCategoryGroupTranslationsDto,
} from '../dto';
import { ModeratorCategoryGroupEntity } from '../entities';

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

type NormalizedTranslation = {
  languageId: number;
  name: string;
};

@Injectable()
export class ModeratorCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

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
      items: groups.map(
        (group) => new ModeratorCategoryGroupEntity(group),
      ),

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
  async findOne(
    groupId: number,
  ): Promise<ModeratorCategoryGroupEntity> {
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
    const code = this.normalizeCode(dto.code);

    const translations = this.normalizeTranslations(
      dto.translations,
    );

    this.ensureDistinctLanguageIds(translations);

    await this.ensureCodeAvailable(code);

    await this.ensureActiveLanguages(
      translations.map(
        (translation) => translation.languageId,
      ),
    );

    await this.ensureTranslationNamesAvailable(
      translations,
    );

    const createdGroup = await this.prisma.$transaction(
      async (tx) =>
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
    if (
      dto.code === undefined &&
      dto.translations === undefined
    ) {
      throw new BadRequestException(
        'Phải cung cấp code hoặc danh sách bản dịch cần cập nhật.',
      );
    }

    await this.ensureActiveGroupExists(groupId);

    const code =
      dto.code === undefined
        ? undefined
        : this.normalizeCode(dto.code);

    const translations =
      dto.translations === undefined
        ? undefined
        : this.normalizeTranslations(dto.translations);

    if (
      translations !== undefined &&
      translations.length === 0
    ) {
      throw new BadRequestException(
        'Danh sách bản dịch không được để trống.',
      );
    }

    if (code !== undefined) {
      await this.ensureCodeAvailable(code, groupId);
    }

    if (translations !== undefined) {
      this.ensureDistinctLanguageIds(translations);

      await this.ensureActiveLanguages(
        translations.map(
          (translation) => translation.languageId,
        ),
      );

      await this.ensureTranslationNamesAvailable(
        translations,
        groupId,
      );
    }

    const updatedGroup = await this.prisma.$transaction(
      async (tx) => {
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
      },
    );

    return new ModeratorCategoryGroupEntity(updatedGroup);
  }

  /**
   * Xóa mềm CategoryGroup và toàn bộ bản dịch.
   *
   * Không cho xóa nếu có bài viết đang sử dụng
   * bất kỳ category nào thuộc group.
   */
  async remove(
    groupId: number,
  ): Promise<ModeratorCategoryGroupEntity> {
    await this.ensureActiveGroupExists(groupId);

    const usageCount =
      await this.prisma.postCategory.count({
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

    const deletedGroup = await this.prisma.$transaction(
      async (tx) => {
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
      },
    );

    return new ModeratorCategoryGroupEntity(deletedGroup);
  }

  /**
   * Kiểm tra group tồn tại và chưa bị xóa.
   */
  private async ensureActiveGroupExists(
    groupId: number,
  ): Promise<void> {
    const group = await this.prisma.categoryGroup.findFirst({
      where: {
        id: groupId,
        deletedAt: null,
      },

      select: {
        id: true,
      },
    });

    if (!group) {
      throw new CategoryGroupNotFoundException(groupId);
    }
  }

  /**
   * Kiểm tra code chưa được group khác sử dụng.
   *
   * Phải kiểm tra cả bản ghi đã soft delete vì cột code
   * vẫn có unique constraint trong database.
   */
  private async ensureCodeAvailable(
    code: string,
    excludedGroupId?: number,
  ): Promise<void> {
    const existingGroup =
      await this.prisma.categoryGroup.findUnique({
        where: {
          code,
        },

        select: {
          id: true,
          deletedAt: true,
        },
      });

    if (
      !existingGroup ||
      existingGroup.id === excludedGroupId
    ) {
      return;
    }

    if (existingGroup.deletedAt !== null) {
      throw new ConflictException(
        `Mã nhóm danh mục "${code}" đã từng tồn tại nhưng đang bị xóa mềm. Không thể tạo lại cùng mã này.`,
      );
    }

    throw new ConflictException(
      `Nhóm danh mục với mã "${code}" đã tồn tại.`,
    );
  }

  /**
   * Kiểm tra toàn bộ languageId:
   * - tồn tại;
   * - chưa bị xóa mềm.
   */
  private async ensureActiveLanguages(
    languageIds: number[],
  ): Promise<void> {
    const uniqueLanguageIds = [...new Set(languageIds)];

    const activeLanguages =
      await this.prisma.language.findMany({
        where: {
          id: {
            in: uniqueLanguageIds,
          },

          deletedAt: null,
        },

        select: {
          id: true,
        },
      });

    const activeLanguageIdSet = new Set(
      activeLanguages.map((language) => language.id),
    );

    const invalidLanguageIds = uniqueLanguageIds.filter(
      (languageId) =>
        !activeLanguageIdSet.has(languageId),
    );

    if (invalidLanguageIds.length > 0) {
      throw new BadRequestException(
        `Các ngôn ngữ không tồn tại hoặc đã bị xóa: ${invalidLanguageIds.join(', ')}.`,
      );
    }
  }

  /**
   * Kiểm tra tên category không trùng với category
   * thuộc group khác.
   *
   * Kiểm tra cả category đã soft delete vì database vẫn
   * áp dụng unique constraint [name, languageId].
   */
  private async ensureTranslationNamesAvailable(
    translations: NormalizedTranslation[],
    excludedGroupId?: number,
  ): Promise<void> {
    if (translations.length === 0) {
      return;
    }

    const where: Prisma.CategoryWhereInput = {
      OR: translations.map((translation) => ({
        name: translation.name,
        languageId: translation.languageId,
      })),
    };

    if (excludedGroupId !== undefined) {
      where.categoryGroupId = {
        not: excludedGroupId,
      };
    }

    const conflict =
      await this.prisma.category.findFirst({
        where,

        select: {
          name: true,
          languageId: true,
          deletedAt: true,
        },
      });

    if (!conflict) {
      return;
    }

    if (conflict.deletedAt !== null) {
      throw new ConflictException(
        `Tên danh mục "${conflict.name}" của ngôn ngữ ID ${conflict.languageId} đã từng tồn tại nhưng đang bị xóa mềm.`,
      );
    }

    throw new ConflictException(
      `Tên danh mục "${conflict.name}" đã được sử dụng cho ngôn ngữ ID ${conflict.languageId}.`,
    );
  }

  /**
   * Service vẫn kiểm tra trùng languageId,
   * không chỉ phụ thuộc vào DTO.
   */
  private ensureDistinctLanguageIds(
    translations: NormalizedTranslation[],
  ): void {
    const languageIds = translations.map(
      (translation) => translation.languageId,
    );

    if (
      new Set(languageIds).size !== languageIds.length
    ) {
      throw new BadRequestException(
        'Mỗi ngôn ngữ chỉ được xuất hiện một lần trong danh sách bản dịch.',
      );
    }
  }

  private normalizeCode(code: string): string {
    return code.trim().toLowerCase();
  }

  private normalizeTranslations(
    translations: CategoryGroupTranslationDto[],
  ): NormalizedTranslation[] {
    return translations.map((translation) => ({
      languageId: Number(translation.languageId),
      name: translation.name.trim(),
    }));
  }
}