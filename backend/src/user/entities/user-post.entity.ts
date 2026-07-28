import { PublicPostEntity } from '../../public/entities';

/**
 * Entity dành riêng cho User API khi hiển thị bài viết (ví dụ: bài viết đã bookmark/lưu, bài viết đã like).
 * Kế thừa PublicPostEntity để ẩn các trường nhạy cảm và format sẵn categories, tags, media, likeCount.
 */
export class UserPostEntity extends PublicPostEntity {
  constructor(partial: Partial<UserPostEntity>) {
    super(partial);
  }
}
