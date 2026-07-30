import { Expose, Type } from 'class-transformer';
import { UserEntity } from '@app/core';
import { AdminUserPostEntity } from './admin-user-post.entity';

/**
 * Entity dành riêng cho Admin để quản lý User.
 *
 * Kế thừa UserEntity từ core và bổ sung:
 * - Danh sách bài viết của người dùng (posts) kèm theo các chỉ số tương tác:
 *   + viewCount (lượt xem)
 *   + likeCount (lượt like)
 *   + commentCount (lượt bình luận)
 */
export class AdminUserEntity extends UserEntity {
  @Expose()
  @Type(() => AdminUserPostEntity)
  posts?: AdminUserPostEntity[];

  constructor(
    partial: Partial<Omit<AdminUserEntity, 'posts'> & { posts?: any[] }>,
  ) {
    super(partial);
    Object.assign(this, partial);

    if (partial.posts && Array.isArray(partial.posts)) {
      this.posts = partial.posts.map((post) =>
        post instanceof AdminUserPostEntity
          ? post
          : new AdminUserPostEntity(post),
      );
    }
  }
}
