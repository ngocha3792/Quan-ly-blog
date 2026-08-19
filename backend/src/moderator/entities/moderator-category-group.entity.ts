import {
  Exclude,
  Expose,
  Type,
} from 'class-transformer';

import {
  CategoryEntity,
  CategoryGroupEntity,
  LanguageEntity,
} from '@app/core';

/**
 * Thông tin ngôn ngữ đi kèm bản dịch category.
 *
 * Không trả trạng thái xóa mềm ra ngoài.
 */
class ModeratorCategoryLanguageEntity extends LanguageEntity {
  @Exclude()
  declare deletedAt: Date | null;

  constructor(
    partial: Partial<ModeratorCategoryLanguageEntity>,
  ) {
    super(partial);
    Object.assign(this, partial);
  }
}

/**
 * Một bản dịch của CategoryGroup.
 *
 * Ví dụ:
 * - Công nghệ - Tiếng Việt
 * - Technology - English
 */
class ModeratorCategoryTranslationEntity extends CategoryEntity {
  /**
   * Group đã được thể hiện ở object cha,
   * không cần trả lại foreign key này.
   */
  @Exclude()
  declare categoryGroupId: number;

  /**
   * Không trả trạng thái xóa mềm.
   */
  @Exclude()
  declare deletedAt: Date | null;

  /**
   * Không trả ngược lại CategoryGroup,
   * tránh dữ liệu lặp và vòng lặp serialize.
   */
  @Exclude()
  declare categoryGroup?: CategoryGroupEntity;

  @Type(() => ModeratorCategoryLanguageEntity)
  declare language?: ModeratorCategoryLanguageEntity;

  constructor(
    partial: Partial<ModeratorCategoryTranslationEntity>,
  ) {
    super(partial);
    Object.assign(this, partial);
  }
}

/**
 * Entity nhóm danh mục dành riêng cho Moderator.
 *
 * Quan hệ trong Prisma:
 * CategoryGroup -> categories
 *
 * Dữ liệu trả ra API:
 * CategoryGroup -> translations
 */
export class ModeratorCategoryGroupEntity extends CategoryGroupEntity {
  /**
   * Không trả trạng thái xóa mềm.
   */
  @Exclude()
  declare deletedAt: Date | null;

  /**
   * Ẩn quan hệ Prisma thô.
   */
  @Exclude()
  declare categories?: ModeratorCategoryTranslationEntity[];

  /**
   * Tổng số bản dịch đang có trong group.
   */
  @Expose()
  get translationCount(): number {
    return this.categories?.length ?? 0;
  }

  /**
   * Chuyển categories thành translations
   * để đúng với ý nghĩa màn hình Moderator.
   */
  @Expose()
  @Type(() => ModeratorCategoryTranslationEntity)
  get translations():
    | ModeratorCategoryTranslationEntity[]
    | undefined {
    if (!this.categories) {
      return undefined;
    }

    return this.categories.map(
      (category) =>
        new ModeratorCategoryTranslationEntity(category),
    );
  }

  constructor(
    partial: Partial<ModeratorCategoryGroupEntity>,
  ) {
    super(partial);
    Object.assign(this, partial);
  }
}