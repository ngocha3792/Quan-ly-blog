import { OmitType } from '@nestjs/mapped-types';
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

  return values.map((item: unknown) => {
    if (typeof item === 'number') {
      return item;
    }

    if (typeof item === 'string' && /^-?\d+$/.test(item.trim())) {
      return Number(item.trim());
    }

    return item;
  });
}

/**
 * Payload tạo một NHÓM bài của Blog Owner.
 *
 * - Post gốc được tạo từ title/content/languageId/categoryIds.
 * - translationLanguageIds là các ngôn ngữ mà backend phải tự dịch và lưu cùng lúc.
 * - submitForReview=false: cả group là DRAFT.
 * - submitForReview=true: cả group là PENDING_REVIEW.
 */
export class CreateBlogownerPostDto extends OmitType(CreatePostDto, [
  'status',
  'parentPostId',
] as const) {
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
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({
    message: 'submitForReview phải là true hoặc false',
  })
  submitForReview?: boolean;
}
