import { Exclude, Expose, Type } from 'class-transformer';
import { CategoryEntity, PostEntity } from '@app/core';

type AdminUserPostCategoryRelation = {
  category: CategoryEntity;
};

type AdminUserPostTagRelation = {
  tag?: {
    id: number;
    name: string;
  };
};

/**
 * Entity bài viết dành riêng cho Admin quản lý User.
 *
 * Kế thừa từ PostEntity (đã có sẵn viewCount) và bổ sung:
 * - likeCount (số lượt thích, lấy từ _count.postLikes của Prisma)
 * - commentCount (số lượt bình luận, lấy từ _count.comments của Prisma)
 */
export class AdminUserPostEntity extends PostEntity {
  /**
   * Ẩn đối tượng đếm thô từ Prisma.
   */
  @Exclude()
  declare _count?: {
    postLikes?: number;
    comments?: number;
  };

  /**
   * Số lượt like của bài viết.
   */
  @Expose()
  get likeCount(): number {
    return this._count?.postLikes ?? 0;
  }

  /**
   * Số lượt bình luận của bài viết.
   */
  @Expose()
  get commentCount(): number {
    return this._count?.comments ?? 0;
  }

  /**
   * Ẩn quan hệ Prisma thô: Post -> PostCategory -> Category
   */
  @Exclude()
  declare postCategories?: AdminUserPostCategoryRelation[];

  /**
   * Ẩn quan hệ Prisma thô: Post -> PostTag -> Tag
   */
  @Exclude()
  declare postTags?: AdminUserPostTagRelation[];

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

  constructor(
    partial: Partial<
      AdminUserPostEntity & {
        _count?: any;
        postCategories?: any[];
        postTags?: any[];
      }
    >,
  ) {
    super(partial);
    Object.assign(this, partial);
  }
}
