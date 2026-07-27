import { Post, PostStatus, type User } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';

import { UserEntity } from '../../users/entities/user.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { LanguageEntity } from '../../languages/entities/language.entity';

type PostAuthorSummary = Pick<User, 'id' | 'username' | 'bio' | 'avatarUrl'>;

type PostCategoryWithCategory = {
  category: CategoryEntity;
};

export class PostEntity implements Post {
  id!: number;
  title!: string;
  thumbnailUrl!: string | null;
  content!: string;
  status!: PostStatus;
  viewCount!: number;
  publishedAt!: Date | null;

  parentPostId!: number | null;
  authorId!: number;
  languageId!: number;

  reviewedById!: number | null;

  reviewedAt!: Date | null;

  rejectionReason!: string | null;

  createdAt!: Date;
  updatedAt!: Date;

  deletedAt!: Date | null;

  @Type(() => UserEntity)
  author?: PostAuthorSummary;

  @Type(() => LanguageEntity)
  language?: LanguageEntity;

  /*
   * Dữ liệu quan hệ thô từ Prisma:
   * Post -> PostCategory -> Category
   */
  postCategories?: PostCategoryWithCategory[];

  /*
   * Trả ra API dưới dạng:
   * categories: [...]
   */
  @Type(() => CategoryEntity)
  get categories(): CategoryEntity[] | undefined {
    if (!this.postCategories) {
      return undefined;
    }

    return this.postCategories.map(
      (postCategory) => new CategoryEntity(postCategory.category),
    );
  }

  postTags?: Array<{
    tag?: {
      id: number;
      name: string;
    };
  }>;

  @Expose()
  get tags():
    | Array<{
      id: number;
      name: string;
    }>
    | undefined {
    if (!this.postTags) {
      return undefined;
    }

    return this.postTags
      .filter((postTag) => postTag.tag)
      .map((postTag) => ({
        id: postTag.tag!.id,
        name: postTag.tag!.name,
      }));
  }

  constructor(partial: Partial<PostEntity>) {
    Object.assign(this, partial);
  }
}
