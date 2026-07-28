import { type Media } from '@prisma/client';
import {
  Exclude,
  Expose,
  Type,
} from 'class-transformer';

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

type PublicMediaSummary = Pick<
  Media,
  'id' | 'postId' | 'mediaType' | 'mediaUrl' | 'createdAt'
>;

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
 * Public vẫn được thấy (kế thừa từ PostEntity):
 * - author (tên tác giả, avatar...)
 * - language (tên ngôn ngữ)
 * - categories (tên danh mục)
 * - tags (tên tag)
 *
 * PublicPostEntity bổ sung thêm:
 * - likeCount (số lượt like)
 * - media (danh sách ảnh/video, đã loại publicId)
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
   * Ẩn đối tượng đếm thô từ Prisma.
   */
  @Exclude()
  declare _count?: {
    postLikes?: number;
  };

  /**
   * Số lượt like của bài viết.
   */
  @Expose()
  get likeCount(): number {
    return this._count?.postLikes ?? 0;
  }

  /**
   * Danh sách media (ảnh/video) của bài viết.
   * Không bao gồm publicId (nội bộ Cloudinary) và deletedAt.
   */
  media?: PublicMediaSummary[];

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

    Object.assign(this, partial);

    if (partial.media) {
      this.media = partial.media.map(
        ({ id, postId, mediaType, mediaUrl, createdAt }) => ({
          id,
          postId,
          mediaType,
          mediaUrl,
          createdAt,
        }),
      );
    }
  }
}