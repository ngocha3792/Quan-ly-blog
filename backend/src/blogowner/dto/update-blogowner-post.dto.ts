import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
} from 'class-validator';

import { CreatePostDto } from '@app/core';

function normalizeIntegerArray(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  let normalized: unknown = value;

  if (typeof value === 'string') {
    const trimmed = value.trim();

    try {
      normalized = JSON.parse(trimmed);
    } catch {
      normalized = trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  const values = Array.isArray(normalized) ? normalized : [normalized];

  return values.map((item) => {
    if (typeof item === 'number') return item;
    if (typeof item === 'string' && /^-?\d+$/.test(item.trim())) {
      return Number(item.trim());
    }
    return item;
  });
}

class EditableBlogownerPostDto extends OmitType(CreatePostDto, [
  'status',
  'parentPostId',
  'languageId',
] as const) {}

/**
 * Chỉnh sửa bài gốc theo cả group.
 *
 * translationLanguageIds:
 * - các bản dịch đã tồn tại luôn được giữ lại và tự dịch lại;
 * - ID mới được thêm vào sẽ tạo thêm bản dịch;
 * - không xóa bản dịch hiện có chỉ vì client bỏ ID khỏi payload.
 *
 * submitForReview:
 * - false/undefined -> cả group về DRAFT;
 * - true            -> cả group sang PENDING_REVIEW.
 */
export class UpdateBlogownerPostDto extends PartialType(
  EditableBlogownerPostDto,
) {
  @IsOptional()
  @Transform(({ value }) => normalizeIntegerArray(value), {
    toClassOnly: true,
  })
  @IsArray({ message: 'translationLanguageIds phải là một mảng' })
  @ArrayUnique({
    message: 'translationLanguageIds không được chứa ngôn ngữ trùng nhau',
  })
  @IsInt({
    each: true,
    message: 'Mỗi mã ngôn ngữ bản dịch phải là số nguyên',
  })
  translationLanguageIds?: number[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({
    message: 'submitForReview phải là true hoặc false',
  })
  submitForReview?: boolean;
}
