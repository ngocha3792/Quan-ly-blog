import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, CategoryGroupNotFoundException } from '@app/core';

@Injectable()
export class ModeratorCategoriesValidator {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kiểm tra group tồn tại và chưa bị xóa.
   */
  async ensureActiveGroupExists(groupId: number): Promise<void> {
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
  async ensureCodeAvailable(
    code: string,
    excludedGroupId?: number,
  ): Promise<void> {
    const existingGroup = await this.prisma.categoryGroup.findUnique({
      where: { code },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    if (!existingGroup || existingGroup.id === excludedGroupId) {
      return;
    }

    if (existingGroup.deletedAt !== null) {
      throw new ConflictException(
        `Mã nhóm danh mục "${code}" đã từng tồn tại nhưng đang bị xóa mềm. Không thể tạo lại cùng mã này.`,
      );
    }

    throw new ConflictException(`Nhóm danh mục với mã "${code}" đã tồn tại.`);
  }

  /**
   * Kiểm tra toàn bộ languageId:
   * - tồn tại;
   * - chưa bị xóa mềm.
   */
  async ensureActiveLanguages(languageIds: number[]): Promise<void> {
    if (languageIds.length === 0) {
      return;
    }

    const uniqueLanguageIds = [...new Set(languageIds)];

    const activeLanguages = await this.prisma.language.findMany({
      where: {
        id: { in: uniqueLanguageIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    const activeLanguageIdSet = new Set(
      activeLanguages.map((language) => language.id),
    );

    const invalidLanguageIds = uniqueLanguageIds.filter(
      (languageId) => !activeLanguageIdSet.has(languageId),
    );

    if (invalidLanguageIds.length > 0) {
      throw new BadRequestException(
        `Các ngôn ngữ không tồn tại hoặc đã bị xóa: ${invalidLanguageIds.join(', ')}.`,
      );
    }
  }

  /**
   * Kiểm tra tên category không trùng với category thuộc group khác.
   *
   * Kiểm tra cả category đã soft delete vì database vẫn
   * áp dụng unique constraint [name, languageId].
   */
  async ensureTranslationNamesAvailable(
    translations: { name: string; languageId: number }[],
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

    const conflict = await this.prisma.category.findFirst({
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
}
