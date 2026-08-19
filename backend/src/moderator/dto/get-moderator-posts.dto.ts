import { OmitType } from '@nestjs/mapped-types';
import { PostStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';

import { GetPostsDto } from '@app/core';

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
export class GetModeratorPostsDto extends OmitType(GetPostsDto, [
  'parentPostId',
  'bookmarkedByUserId',
  'status',
] as const) {
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
}