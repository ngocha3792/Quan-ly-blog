import { PostStatus } from '@prisma/client';
import {
  Exclude,
  Type,
} from 'class-transformer';
import { ReportEntity } from '@app/core';

/**
 * Thông tin người dùng được phép trả trong màn hình Moderator.
 */
class ModeratorReportUserEntity {
  id!: number;
  username!: string;
  avatarUrl!: string | null;

  constructor(partial: Partial<ModeratorReportUserEntity>) {
    Object.assign(this, partial);
  }
}

/**
 * Thông tin bài viết bị báo cáo.
 *
 * Moderator cần đọc nội dung thực tế để quyết định
 * report có đúng hay không.
 */
class ModeratorReportedPostEntity {
  id!: number;
  title!: string;
  thumbnailUrl!: string | null;
  content!: string;
  status!: PostStatus;
  authorId!: number;
  publishedAt!: Date | null;
  createdAt!: Date;

  @Type(() => ModeratorReportUserEntity)
  author?: ModeratorReportUserEntity;

  constructor(
    partial: Partial<ModeratorReportedPostEntity>,
  ) {
    Object.assign(this, partial);
  }
}

/**
 * Bình luận cha để Moderator hiểu ngữ cảnh
 * khi report nhắm vào một reply.
 */
class ModeratorParentCommentEntity {
  id!: number;
  userId!: number;
  content!: string;
  createdAt!: Date;

  @Type(() => ModeratorReportUserEntity)
  user?: ModeratorReportUserEntity;

  constructor(
    partial: Partial<ModeratorParentCommentEntity>,
  ) {
    Object.assign(this, partial);
  }
}

/**
 * Thông tin bình luận bị báo cáo.
 */
class ModeratorReportedCommentEntity {
  id!: number;
  postId!: number;
  userId!: number;
  parentId!: number | null;
  content!: string;
  createdAt!: Date;

  @Type(() => ModeratorReportUserEntity)
  user?: ModeratorReportUserEntity;

  /**
   * Bài viết chứa bình luận.
   */
  @Type(() => ModeratorReportedPostEntity)
  post?: ModeratorReportedPostEntity;

  /**
   * Có giá trị khi comment bị report là một reply.
   */
  @Type(() => ModeratorParentCommentEntity)
  parent?: ModeratorParentCommentEntity | null;

  constructor(
    partial: Partial<ModeratorReportedCommentEntity>,
  ) {
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
  reporter?: ModeratorReportUserEntity;

  @Type(() => ModeratorReportUserEntity)
  reviewedBy?: ModeratorReportUserEntity | null;

  @Type(() => ModeratorReportedPostEntity)
  post?: ModeratorReportedPostEntity | null;

  @Type(() => ModeratorReportedCommentEntity)
  comment?: ModeratorReportedCommentEntity | null;

  constructor(partial: Partial<ModeratorReportEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}