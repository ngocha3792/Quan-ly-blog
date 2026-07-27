import {
  type Media,
  type User,
} from '@prisma/client';
import {
  Exclude,
  Expose,
  Type,
} from 'class-transformer';

import {
  CategoryEntity,
  PostEntity,
  UserEntity,
} from '@app/core';

type ModeratorPostCategoryRelation = {
  category: CategoryEntity;
};

type ModeratorPostTagRelation = {
  tag?: {
    id: number;
    name: string;
  };
};

type ModeratorReviewerSummary = Pick<
  User,
  'id' | 'username' | 'avatarUrl'
>;

type ModeratorMediaSummary = Pick<
  Media,
  | 'id'
  | 'postId'
  | 'mediaType'
  | 'mediaUrl'
  | 'publicId'
  | 'createdAt'
>;

/**
 * Entity bài viết dành riêng cho Moderator.
 *
 * Moderator được xem:
 * - toàn bộ tiêu đề và nội dung;
 * - tác giả;
 * - ngôn ngữ;
 * - category và tag;
 * - media;
 * - trạng thái;
 * - thời điểm kiểm duyệt;
 * - lý do từ chối;
 * - người đã xử lý trước đó.
 *
 * Moderator không nhận:
 * - deletedAt;
 * - các quan hệ Prisma thô.
 */
export class ModeratorPostEntity extends PostEntity {
  /**
   * Không trả trạng thái xóa mềm ra response.
   */
  @Exclude()
  declare deletedAt: Date | null;

  /**
   * Chỉ trả reviewedBy dưới dạng object gọn,
   * không trả trực tiếp foreign key.
   */
  @Exclude()
  declare reviewedById: number | null;

@Type(() => UserEntity)
reviewedBy?: ModeratorReviewerSummary | null;

  /**
   * Danh sách ảnh/video của bài viết.
   */
  media?: ModeratorMediaSummary[];

  /**
   * Quan hệ Prisma thô:
   * Post -> PostCategory -> Category
   */
  @Exclude()
  declare postCategories?: ModeratorPostCategoryRelation[];

  /**
   * Quan hệ Prisma thô:
   * Post -> PostTag -> Tag
   */
  @Exclude()
  declare postTags?: ModeratorPostTagRelation[];

  /**
   * Danh sách category đã được làm phẳng.
   */
  @Expose()
  @Type(() => CategoryEntity)
  override get categories(): CategoryEntity[] | undefined {
    return super.categories;
  }

  /**
   * Danh sách tag đã được làm phẳng.
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

  constructor(partial: Partial<ModeratorPostEntity>) {
  super(partial);

  /**
   * Gán lại các thuộc tính riêng của ModeratorPostEntity
   * như media và reviewedBy sau khi constructor class cha chạy.
   */
  Object.assign(this, partial);
}
}