import { Exclude } from 'class-transformer';
import { BlogOwnerRequestEntity } from '@app/core';

/**
 * Entity yêu cầu trở thành tác giả blog dành riêng cho User API.
 *
 * Kế thừa BlogOwnerRequestEntity từ core nhưng đảm bảo:
 * - Ẩn trường nội bộ nhạy cảm: reviewedById (ID admin/moderator đã xử lý yêu cầu)
 * - Hiển thị các trường thông tin cần thiết: status, lý do (reason), chủ đề (topics), thời gian duyệt (reviewedAt), lý do từ chối (rejectionReason nếu bị từ chối)
 */
export class UserBlogOwnerRequestEntity extends BlogOwnerRequestEntity {
  /**
   * Ẩn ID của Admin / Moderator đã duyệt yêu cầu.
   */
  @Exclude()
  declare reviewedById: number | null;

  constructor(partial: Partial<UserBlogOwnerRequestEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}
