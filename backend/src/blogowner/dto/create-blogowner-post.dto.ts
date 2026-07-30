import { OmitType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
} from 'class-validator';

import { CreatePostDto } from '@app/core';

/**
 * Dữ liệu Blog Owner được phép gửi khi tạo bài.
 *
 * Không cho phép Blog Owner tự gửi:
 * - status: backend quản lý vòng đời bài viết;
 * - parentPostId: chỉ service tạo bản dịch mới được thiết lập.
 *
 * submitForReview:
 * - false / undefined -> DRAFT;
 * - true              -> PENDING_REVIEW sau khi tạo/upload hoàn tất.
 */
export class CreateBlogownerPostDto extends OmitType(
  CreatePostDto,
  [
    'status',
    'parentPostId',
  ] as const,
) {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean({
    message:
      'submitForReview phải là true hoặc false',
  })
  submitForReview?: boolean;
}