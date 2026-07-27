import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PostStatus } from '@prisma/client';

/**
 * Bộ lọc danh sách bài viết dành cho Moderator.
 *
 * Moderator được xem:
 * - PENDING_REVIEW: bài đang chờ duyệt
 * - PUBLISH: bài đã được duyệt
 * - REJECT: bài đã bị từ chối
 *
 * Không cho xem DRAFT vì đây là bài riêng của Blog Owner,
 * chưa gửi sang quy trình kiểm duyệt.
 */
export class GetModeratorPostsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  languageId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  authorId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  tagId?: number;

  @IsOptional()
  @IsString()
  tagName?: string;

  @IsOptional()
  @IsIn(
    [
      PostStatus.PENDING_REVIEW,
      PostStatus.PUBLISH,
      PostStatus.REJECT,
    ],
    {
      message:
        'Moderator chỉ được lọc bài theo PENDING_REVIEW, PUBLISH hoặc REJECT.',
    },
  )
  status?: PostStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}