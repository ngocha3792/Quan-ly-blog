import { Exclude, Type } from 'class-transformer';
import { MediaEntity, PostEntity } from '@app/core';

/**
 * Entity trả dữ liệu riêng cho Blog Owner.
 *
 * Kế thừa PostEntity (đã mở sẵn mọi thứ) và bổ sung/ẩn:
 * - Tự động được xem reviewedAt và rejectionReason từ class cha.
 * - ẨN reviewedById và deletedAt.
 * - Trả danh sách media của bài viết.
 */
export class BlogownerPostEntity extends PostEntity {

  /**
   * ẨN thông tin người duyệt (Blog Owner không được biết ai duyệt)
   */
  @Exclude()
  declare reviewedById: number | null;

  /**
   * ẨN thời gian xóa mềm
   */
  @Exclude()
  declare deletedAt: Date | null;

  /**
   * Danh sách ảnh/video thuộc bài viết.
   */
  @Type(() => MediaEntity)
  media?: MediaEntity[];

  constructor(partial: Partial<BlogownerPostEntity>) {
    super(partial);

    if (partial.media) {
      this.media = partial.media.map((item) =>
        item instanceof MediaEntity ? item : new MediaEntity(item),
      );
    }
  }
}