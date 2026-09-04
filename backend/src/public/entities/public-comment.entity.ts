import { Exclude, Expose } from 'class-transformer';

import { CommentEntity } from '@app/core';

type PublicCommentCount = {
  replies: number;
};

/**
 * Entity riêng cho Public Comment API.
 *
 * Root comment chỉ chứa một số reply preview.
 * Tổng số reply lấy bằng relation count.
 */
export class PublicCommentEntity extends CommentEntity {
  /**
   * Không expose object Prisma _count ra frontend.
   */
  @Exclude()
  declare _count?: PublicCommentCount;

  /**
   * Tổng số reply chưa bị xóa.
   */
  @Expose()
  get replyCount(): number {
    return this._count?.replies ?? 0;
  }

  /**
   * Frontend dùng field này để quyết định
   * có hiện nút "Xem thêm phản hồi" hay không.
   */
  @Expose()
  get hasMoreReplies(): boolean {
    return this.replyCount > (this.replies?.length ?? 0);
  }

  constructor(partial: Partial<PublicCommentEntity>) {
    super(partial);
  }
}
