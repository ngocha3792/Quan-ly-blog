import { Exclude, Expose, Type } from 'class-transformer';

import {
  CategoryEntity,
  PostEntity,
} from '@app/core';

type PublicPostCategoryRelation = {
  category: CategoryEntity;
};

type PublicPostTagRelation = {
  tag?: {
    id: number;
    name: string;
  };
};

/**
 * Entity dành riêng cho Public Post API.
 *
 * Public không được thấy:
 * - Moderator nào duyệt.
 * - Thời gian kiểm duyệt nội bộ.
 * - Lý do từng bị từ chối.
 * - Thời gian xóa mềm.
 * - Các quan hệ Prisma thô.
 *
 * Public vẫn được thấy:
 * - categories
 * - tags
 * - author
 * - language
 */
export class PublicPostEntity extends PostEntity {
  /**
   * Không để Public biết Moderator nào đã duyệt.
   */
  @Exclude()
  declare reviewedById: number | null;

  /**
   * Đây là dữ liệu kiểm duyệt nội bộ.
   */
  @Exclude()
  declare reviewedAt: Date | null;

  /**
   * Lý do từ chối chỉ Blog Owner được xem.
   */
  @Exclude()
  declare rejectionReason: string | null;

  /**
   * Không trả trường xóa mềm ra Public.
   */
  @Exclude()
  declare deletedAt: Date | null;

  /**
   * Ẩn quan hệ Prisma thô:
   * Post -> PostCategory -> Category
   */
  @Exclude()
  declare postCategories?: PublicPostCategoryRelation[];

  /**
   * Ẩn quan hệ Prisma thô:
   * Post -> PostTag -> Tag
   */
  @Exclude()
  declare postTags?: PublicPostTagRelation[];

  /**
   * Trả danh mục đã được làm phẳng.
   */
  @Expose()
  @Type(() => CategoryEntity)
  override get categories(): CategoryEntity[] | undefined {
    return super.categories;
  }

  /**
   * Trả tag đã được làm phẳng.
   */
  @Expose()
  override get tags():
    | Array<{
        id: number;
        name: string;
      }>
    | undefined {
    return super.tags;
  }

  constructor(partial: Partial<PublicPostEntity>) {
    super(partial);
  }
}