import { Exclude, Type } from 'class-transformer';
import { CommentEntity, PostEntity, ReportEntity, UserEntity } from '@app/core';

/**
 * Thông tin người dùng được phép trả trong màn hình Moderator.
 * Kế thừa UserEntity từ Core, loại bỏ các thông tin nhạy cảm/nội bộ.
 */
class ModeratorReportUserEntity extends UserEntity {
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

  constructor(partial: Partial<ModeratorReportUserEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}

type ModeratorReportUserSummary = Pick<
  UserEntity,
  'id' | 'username' | 'avatarUrl'
>;

/**
 * Thông tin bài viết bị báo cáo.
 *
 * Moderator cần đọc nội dung thực tế để quyết định
 * report có đúng hay không. Kế thừa PostEntity từ Core.
 */
class ModeratorReportedPostEntity extends PostEntity {
  @Exclude()
  declare deletedAt: Date | null;

  @Exclude()
  declare postCategories?: any;

  @Exclude()
  declare postTags?: any;

  @Type(() => ModeratorReportUserEntity)
  declare author?: any;

  constructor(partial: Partial<ModeratorReportedPostEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}

/**
 * Bình luận cha để Moderator hiểu ngữ cảnh
 * khi report nhắm vào một reply. Kế thừa CommentEntity từ Core.
 */
class ModeratorParentCommentEntity extends CommentEntity {
  @Exclude()
  declare deletedAt: Date | null;

  @Type(() => ModeratorContextReplyEntity)
  declare replies?: any[];

  @Type(() => ModeratorReportUserEntity)
  declare user?: any;

  constructor(partial: Partial<ModeratorParentCommentEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}

/** Một phản hồi trong chuỗi hội thoại dùng làm ngữ cảnh kiểm duyệt. */
class ModeratorContextReplyEntity extends CommentEntity {
  @Exclude()
  declare deletedAt: Date | null;

  @Exclude()
  declare replies?: any[];

  @Type(() => ModeratorReportUserEntity)
  declare user?: any;

  constructor(partial: Partial<ModeratorContextReplyEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}

/**
 * Thông tin bình luận bị báo cáo. Kế thừa CommentEntity từ Core.
 */
class ModeratorReportedCommentEntity extends CommentEntity {
  @Exclude()
  declare deletedAt: Date | null;

  @Type(() => ModeratorContextReplyEntity)
  declare replies?: any[];

  @Type(() => ModeratorReportUserEntity)
  declare user?: any;

  /**
   * Bài viết chứa bình luận.
   */
  @Type(() => ModeratorReportedPostEntity)
  post?: Partial<ModeratorReportedPostEntity>;

  /**
   * Có giá trị khi comment bị report là một reply.
   */
  @Type(() => ModeratorParentCommentEntity)
  parent?: Partial<ModeratorParentCommentEntity> | null;

  constructor(partial: Partial<ModeratorReportedCommentEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}

/**
 * Entity báo cáo dành riêng cho Moderator.
 *
 * targetType = POST:
 * - post có dữ liệu
 * - comment = null
 *
 * targetType = COMMENT:
 * - comment có dữ liệu
 * - post có thể null ở cấp report,
 *   nhưng comment.post chứa ngữ cảnh bài viết.
 */
export class ModeratorReportEntity extends ReportEntity {
  /**
   * Ẩn foreign key thô và trả reviewedBy dạng object.
   */
  @Exclude()
  declare reviewedById: number | null;

  @Type(() => ModeratorReportUserEntity)
  reporter?: ModeratorReportUserSummary;

  @Type(() => ModeratorReportUserEntity)
  reviewedBy?: ModeratorReportUserSummary | null;

  @Type(() => ModeratorReportedPostEntity)
  post?: Partial<ModeratorReportedPostEntity> | null;

  @Type(() => ModeratorReportedCommentEntity)
  comment?: Partial<ModeratorReportedCommentEntity> | null;

  constructor(partial: Partial<ModeratorReportEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}
