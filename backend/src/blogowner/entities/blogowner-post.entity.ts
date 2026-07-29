import { Exclude, Type } from 'class-transformer';
import { MediaEntity, PostEntity } from '@app/core';
import { PostStatus } from '@prisma/client';
/**
 * Entity trả dữ liệu riêng cho Blog Owner.
 *
 * Kế thừa PostEntity (đã mở sẵn mọi thứ) và bổ sung/ẩn:
 * - Tự động được xem reviewedAt và rejectionReason từ class cha.
 * - ẨN reviewedById và deletedAt.
 * - Trả danh sách media của bài viết.
 */
export type BlogownerTranslationSummary = {
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
export class BlogownerPostEntity extends PostEntity {
  @Exclude()
  declare reviewedById: number | null;

  @Exclude()
  declare deletedAt: Date | null;

  @Type(() => MediaEntity)
  media?: MediaEntity[];

  /**
   * Các phiên bản ngôn ngữ trong cùng nhóm dịch.
   * Bao gồm bài gốc và các bản dịch chưa bị xóa.
   */
  translations?: BlogownerTranslationSummary[];

  constructor(partial: Partial<BlogownerPostEntity>) {
    super(partial);

    if (partial.media) {
      this.media = partial.media.map((item) =>
        item instanceof MediaEntity ? item : new MediaEntity(item),
      );
    }

    this.translations = partial.translations;
  }
}