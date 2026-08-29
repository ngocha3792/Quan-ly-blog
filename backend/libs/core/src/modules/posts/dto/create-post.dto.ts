import {
  MAX_POST_CONTENT_LENGTH,
  sanitizePostContent,
} from '@app/core/common/utils/post-content.util';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PostStatus } from '@prisma/client';

import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

/**
 * Chuẩn hóa giá trị array nhận từ JSON hoặc multipart/form-data.
 *
 * Hỗ trợ:
 * - [73, 75]
 * - '[73,75]'
 * - '73,75'
 * - '73'
 * - nhiều field cùng tên do Multer gom thành array
 */
function normalizeArray(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [value];
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(trimmedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
      : [parsedValue];
  } catch {
    return trimmedValue
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}

/**
 * Chỉ chuyển chuỗi số nguyên hợp lệ thành number.
 * Giá trị sai như "abc" được giữ nguyên để @IsInt báo đúng một lỗi,
 * tránh biến thành NaN rồi làm @ArrayUnique báo nhầm lỗi trùng lặp.
 */
function transformIntegerArray(value: unknown): unknown {
  const normalizedValue = normalizeArray(value);

  if (!Array.isArray(normalizedValue)) {
    return normalizedValue;
  }

  return normalizedValue.map((item) => {
    if (typeof item === 'number') {
      return item;
    }

    if (
      typeof item === 'string' &&
      /^-?\d+$/.test(item.trim())
    ) {
      return Number(item.trim());
    }

    return item;
  });
}

function transformStringArray(value: unknown): unknown {
  const normalizedValue = normalizeArray(value);

  if (!Array.isArray(normalizedValue)) {
    return normalizedValue;
  }

  return normalizedValue.map((item) =>
    typeof item === 'string' ? item.trim() : item,
  );
}

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(255, {
    message: 'Tiêu đề không được vượt quá 255 ký tự',
  })
  @IsProfanityFree()
  title!: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'URL ảnh đại diện không hợp lệ' })
  thumbnailUrl?: string;

 @Transform(
  ({ value }) =>
    sanitizePostContent(value),
  {
    toClassOnly: true,
  },
)
@IsString()
@IsNotEmpty({
  message:
    'Nội dung không được để trống',
})
@MaxLength(
  MAX_POST_CONTENT_LENGTH,
  {
    message:
      `Nội dung bài viết không được vượt quá ${MAX_POST_CONTENT_LENGTH} ký tự`,
  },
)
@IsProfanityFree()
content!: string;

  @IsOptional()
  @IsEnum(PostStatus, {
    message: 'Trạng thái bài viết không hợp lệ',
  })
  status?: PostStatus;

  @IsOptional()
  @IsInt({ message: 'Mã bài viết cha phải là số nguyên' })
  @Type(() => Number)
  parentPostId?: number;

  @Transform(({ value }) => transformIntegerArray(value), {
    toClassOnly: true,
  })
  @IsArray({ message: 'Danh sách danh mục phải là một mảng' })
  @ArrayMinSize(1, {
    message: 'Bài viết phải có ít nhất một danh mục',
  })
  @ArrayUnique({
    message: 'Danh sách danh mục không được chứa mã trùng nhau',
  })
  @IsInt({
    each: true,
    message: 'Mỗi mã danh mục phải là số nguyên',
  })
  categoryIds!: number[];

  @IsInt({ message: 'Mã ngôn ngữ phải là số nguyên' })
  @Type(() => Number)
  languageId!: number;

  @IsOptional()
  @Transform(({ value }) => transformIntegerArray(value), {
    toClassOnly: true,
  })
  @IsArray({ message: 'Danh sách thẻ phải là một mảng' })
  @ArrayUnique({
    message: 'Danh sách thẻ không được chứa mã trùng nhau',
  })
  @IsInt({
    each: true,
    message: 'Mỗi mã thẻ phải là số nguyên',
  })
  tagIds?: number[];

  @IsOptional()
  @Transform(({ value }) => transformStringArray(value), {
    toClassOnly: true,
  })
  @IsArray({
    message: 'Danh sách tên thẻ phải là một mảng',
  })
  @ArrayUnique({
    message: 'Danh sách tên thẻ không được trùng nhau',
  })
  @IsString({ each: true, message: 'Tên thẻ phải là chuỗi' })
  tagNames?: string[];
}