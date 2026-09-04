import { Exclude, Type } from 'class-transformer';
import { PostStatus } from '@prisma/client';

import { MediaEntity, PostEntity } from '@app/core';

/**
 * Thông tin tóm tắt của một phiên bản ngôn ngữ
 * trong cùng nhóm bài viết.
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

type BlogownerPostCount = {
  postLikes: number;
};

export type BlogownerPostGroupTotals = {
  views: number;
  likes: number;
};

/**
 * Một nhóm bài đa ngôn ngữ của Blog Owner.
 *
 * - root luôn là bài gốc (parentPostId = null);
 * - translations chứa toàn bộ bản dịch active của root;
 * - totals dùng để sắp xếp/hiển thị thống kê theo cả nhóm;
 * - latestUpdatedAt là thời điểm chỉnh sửa mới nhất trong nhóm.
 */
export type BlogownerPostGroup = {
  root: BlogownerPostEntity;
  translations: BlogownerPostEntity[];
  totals: BlogownerPostGroupTotals;
  latestUpdatedAt: Date;
};

/**
 * Entity trả dữ liệu riêng cho Blog Owner.
 *
 * Kế thừa PostEntity và bổ sung/ẩn:
 * - được xem reviewedAt và rejectionReason;
 * - ẩn reviewedById và deletedAt;
 * - chuyển _count.postLikes thành likeCount;
 * - đặt likeCount ngay sau viewCount trong JSON;
 * - trả danh sách media;
 * - trả các phiên bản ngôn ngữ cùng nhóm.
 */
export class BlogownerPostEntity extends PostEntity {
  @Exclude()
  declare reviewedById: number | null;

  @Exclude()
  declare deletedAt: Date | null;

  /**
   * Dữ liệu đếm quan hệ nội bộ do Prisma trả về.
   * Chỉ dùng để tạo likeCount, không trả trực tiếp ra API.
   */
  @Exclude()
  declare _count?: BlogownerPostCount;

  /**
   * Tổng lượt thích của bài viết.
   */
  likeCount!: number;

  @Type(() => MediaEntity)
  media?: MediaEntity[];

  /**
   * Các phiên bản ngôn ngữ trong cùng nhóm dịch.
   * Bao gồm bài gốc và các bản dịch chưa bị xóa.
   */
  translations?: BlogownerTranslationSummary[];

  constructor(partial: Partial<BlogownerPostEntity>) {
    const {
      _count,
      likeCount: providedLikeCount,

      id,
      title,
      thumbnailUrl,
      content,
      status,
      viewCount,

      media,
      translations,

      ...remainingData
    } = partial;

    const likeCount = providedLikeCount ?? _count?.postLikes ?? 0;

    /**
     * Chủ động sắp xếp property trước khi PostEntity
     * gọi Object.assign().
     *
     * Nhờ vậy JSON trả về có thứ tự:
     * status -> viewCount -> likeCount -> publishedAt.
     */
    const orderedPartial: Partial<BlogownerPostEntity> = {
      id,
      title,
      thumbnailUrl,
      content,
      status,
      viewCount,
      likeCount,

      ...remainingData,

      media,
      translations,
    };

    super(orderedPartial);

    /**
     * Với cấu hình class fields của TypeScript,
     * property của class con có thể được khởi tạo lại
     * sau khi super() hoàn tất.
     *
     * Gán lại để bảo đảm giá trị luôn chính xác,
     * nhưng không làm thay đổi vị trí property.
     */
    this.likeCount = likeCount;

    if (media) {
      this.media = media.map((item) =>
        item instanceof MediaEntity ? item : new MediaEntity(item),
      );
    }

    this.translations = translations;
  }
}
