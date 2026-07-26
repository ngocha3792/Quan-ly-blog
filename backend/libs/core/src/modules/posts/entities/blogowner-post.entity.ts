import { Post, PostStatus, type User } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';

import { CategoryEntity } from '../../categories/entities/category.entity';
import { LanguageEntity } from '../../languages/entities/language.entity';
import { MediaEntity } from '../../media/entities/media.entity';
import { UserEntity } from '../../users/entities/user.entity';

type PostAuthorSummary = Pick<User, 'id' | 'username' | 'bio' | 'avatarUrl'>;

type PostCategoryWithCategory = {
  category: CategoryEntity;
};

type PostTagWithTag = {
  tag?: {
    id: number;
    name: string;
  };
};

/**
 * Entity trả dữ liệu riêng cho Blog Owner.
 *
 * Khác với PostEntity public:
 * - Cho phép xem reviewedAt.
 * - Cho phép xem rejectionReason.
 * - Trả danh sách media của bài viết.
 * - Vẫn ẩn reviewedById và deletedAt.
 */
export class BlogownerPostEntity implements Post {
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

  @Exclude()
  reviewedById!: number | null;

  reviewedAt!: Date | null;
  rejectionReason!: string | null;

  createdAt!: Date;
  updatedAt!: Date;

  @Exclude()
  deletedAt!: Date | null;

  @Type(() => UserEntity)
  author?: PostAuthorSummary;

  @Type(() => LanguageEntity)
  language?: LanguageEntity;

  /**
   * Danh sách ảnh/video thuộc bài viết.
   */
  @Type(() => MediaEntity)
  media?: MediaEntity[];

  /**
   * Quan hệ Prisma:
   * Post -> PostCategory -> Category
   */
  @Exclude()
  postCategories?: PostCategoryWithCategory[];

  /**
   * Dữ liệu trả ra ngoài:
   * categories: [...]
   */
  @Expose()
  @Type(() => CategoryEntity)
  get categories(): CategoryEntity[] | undefined {
    if (!this.postCategories) {
      return undefined;
    }

    return this.postCategories.map(
      (postCategory) => new CategoryEntity(postCategory.category),
    );
  }

  /**
   * Quan hệ Prisma:
   * Post -> PostTag -> Tag
   */
  @Exclude()
  postTags?: PostTagWithTag[];

  /**
   * Dữ liệu trả ra ngoài:
   * tags: [...]
   */
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
      .filter(
        (
          postTag,
        ): postTag is {
          tag: {
            id: number;
            name: string;
          };
        } => postTag.tag !== undefined,
      )
      .map((postTag) => ({
        id: postTag.tag.id,
        name: postTag.tag.name,
      }));
  }

  constructor(partial: Partial<BlogownerPostEntity>) {
    Object.assign(this, partial);

    if (partial.media) {
      this.media = partial.media.map((item) =>
        item instanceof MediaEntity ? item : new MediaEntity(item),
      );
    }
  }
}