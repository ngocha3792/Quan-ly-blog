import {
  type Media,
  type PostStatus,
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
 * Một phiên bản ngôn ngữ trong cùng Post Group.
 *
 * Dùng để Moderator biết group hiện có:
 * - VI
 * - EN
 * - JA
 * - KO...
 *
 * Khi click tab, frontend sẽ gọi lại:
 * GET /moderator/posts/:postId
 * để lấy full content của version đó.
 */
export type ModeratorTranslationSummary = {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  status: PostStatus;
  parentPostId: number | null;
  languageId: number;

  language: {
    id: number;
    code: string;
    name: string;
    flag: string | null;
  };
};

/**
 * Entity bài viết dành riêng cho Moderator.
 */
export class ModeratorPostEntity extends PostEntity {
  @Exclude()
  declare deletedAt: Date | null;

  @Exclude()
  declare reviewedById: number | null;

  @Type(() => UserEntity)
  reviewedBy?: ModeratorReviewerSummary | null;

  media?: ModeratorMediaSummary[];

  /**
   * Các phiên bản ngôn ngữ thuộc cùng Post Group.
   *
   * Giống cách Blog Owner detail đang trả translations.
   */
  translations?: ModeratorTranslationSummary[];

  @Exclude()
  declare postCategories?: ModeratorPostCategoryRelation[];

  @Exclude()
  declare postTags?: ModeratorPostTagRelation[];

  @Expose()
  @Type(() => CategoryEntity)
  override get categories(): CategoryEntity[] | undefined {
    return super.categories;
  }

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

    Object.assign(this, partial);
  }
}