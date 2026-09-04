import { Exclude, Type } from 'class-transformer';
import { CommentEntity, PostEntity, ReportEntity, UserEntity } from '@app/core';

/**
 * Tóm tắt tác giả bài viết hoặc người bình luận, kế thừa UserEntity từ Core.
 * Ẩn email và các trường kiểm duyệt/xóa mềm.
 */
class UserReportAuthorEntity extends UserEntity {
  @Exclude()
  declare email: string;

  @Exclude()
  declare deletedAt: Date | null;

  @Exclude()
  declare lockedById: number | null;

  @Exclude()
  declare lockedAt: Date | null;

  @Exclude()
  declare lockReason: string | null;

  constructor(partial: Partial<UserReportAuthorEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}

/**
 * Thông tin bài viết bị báo cáo, kế thừa PostEntity từ Core.
 * Ẩn các trường kiểm duyệt nội bộ và xóa mềm.
 */
class UserReportedPostEntity extends PostEntity {
  @Exclude()
  declare reviewedById: number | null;

  @Exclude()
  declare reviewedAt: Date | null;

  @Exclude()
  declare rejectionReason: string | null;

  @Exclude()
  declare deletedAt: Date | null;

  @Exclude()
  declare postCategories?: any;

  @Exclude()
  declare postTags?: any;

  @Exclude()
  declare _count?: any;

  @Type(() => UserReportAuthorEntity)
  declare author?: UserReportAuthorEntity;

  constructor(partial: Partial<UserReportedPostEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}

/**
 * Thông tin bình luận bị báo cáo, kế thừa CommentEntity từ Core.
 * Ẩn trường xóa mềm deletedAt và cây phản hồi (replies).
 */
class UserReportedCommentEntity extends CommentEntity {
  @Exclude()
  declare deletedAt: Date | null;

  @Exclude()
  declare replies?: any[];

  @Type(() => UserReportAuthorEntity)
  declare user?: UserReportAuthorEntity;

  @Type(() => UserReportedPostEntity)
  post?: UserReportedPostEntity;

  constructor(partial: Partial<UserReportedCommentEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}

/**
 * Entity báo cáo dành cho User API.
 *
 * Kế thừa ReportEntity từ core, đồng thời:
 * - Ẩn thông tin nhạy cảm: reviewedById (ID người/mod duyệt report), resolutionNote (ghi chú xử lý nội bộ)
 * - Hiển thị chi tiết bài viết (post) hoặc bình luận (comment) bị báo cáo với các trường an toàn
 */
export class UserReportEntity extends ReportEntity {
  /**
   * Ẩn ID của Moderator / Admin đã xử lý báo cáo.
   */
  @Exclude()
  declare reviewedById: number | null;

  /**
   * Ẩn ghi chú giải quyết nội bộ của Moderator / Admin.
   */
  @Exclude()
  declare resolutionNote: string | null;

  /**
   * Thông tin bài viết bị báo cáo (khi targetType = POST).
   */
  @Type(() => UserReportedPostEntity)
  post?: UserReportedPostEntity | null;

  /**
   * Thông tin bình luận bị báo cáo (khi targetType = COMMENT).
   */
  @Type(() => UserReportedCommentEntity)
  comment?: UserReportedCommentEntity | null;

  constructor(partial: Partial<UserReportEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}
