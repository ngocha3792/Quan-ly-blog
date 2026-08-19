import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

import { IsProfanityFree } from '@app/core';

/**
 * Dữ liệu tạo bản dịch từ một bài viết nguồn.
 *
 * Category và Tag không nhận từ client:
 * - Category được backend tìm theo CategoryGroup và ngôn ngữ đích.
 * - Tag được sao chép từ bài nguồn.
 */
export class TranslateBlogownerPostDto {
  @IsInt({
    message: 'Mã ngôn ngữ đích phải là số nguyên',
  })
  @Type(() => Number)
  targetLanguageId!: number;

  @IsString()
  @IsNotEmpty({
    message: 'Tiêu đề bản dịch không được để trống',
  })
  @MaxLength(255, {
    message: 'Tiêu đề bản dịch không được vượt quá 255 ký tự',
  })
  @IsProfanityFree()
  title!: string;

  @IsString()
  @IsNotEmpty({
    message: 'Nội dung bản dịch không được để trống',
  })
  @IsProfanityFree()
  content!: string;

  @IsOptional()
  @IsString()
  @IsUrl(
    {},
    {
      message: 'URL ảnh đại diện không hợp lệ',
    },
  )
  thumbnailUrl?: string;
}
