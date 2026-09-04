import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { IsProfanityFree } from '@app/core';

/**
 * Một bản dịch của nhóm danh mục.
 *
 * Ví dụ:
 * {
 *   "languageId": 4,
 *   "name": "Công nghệ"
 * }
 */
export class CategoryGroupTranslationDto {
  @Type(() => Number)
  @IsInt({
    message: 'Mã ngôn ngữ phải là số nguyên.',
  })
  @Min(1, {
    message: 'Mã ngôn ngữ phải lớn hơn hoặc bằng 1.',
  })
  languageId!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Tên danh mục phải là chuỗi.',
  })
  @IsNotEmpty({
    message: 'Tên danh mục không được để trống.',
  })
  @MaxLength(100, {
    message: 'Tên danh mục không được vượt quá 100 ký tự.',
  })
  @IsProfanityFree()
  name!: string;
}

/**
 * Moderator tạo một CategoryGroup cùng nhiều bản dịch.
 *
 * Ví dụ:
 * {
 *   "code": "programming",
 *   "translations": [
 *     {
 *       "languageId": 4,
 *       "name": "Lập trình"
 *     },
 *     {
 *       "languageId": 1,
 *       "name": "Programming"
 *     }
 *   ]
 * }
 */
export class CreateCategoryGroupTranslationsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString({
    message: 'Mã nhóm danh mục phải là chuỗi.',
  })
  @IsNotEmpty({
    message: 'Mã nhóm danh mục không được để trống.',
  })
  @MaxLength(50, {
    message: 'Mã nhóm danh mục không được vượt quá 50 ký tự.',
  })
  @Matches(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
    message:
      'Mã nhóm danh mục chỉ được chứa chữ thường không dấu, số, dấu gạch ngang hoặc gạch dưới.',
  })
  code!: string;

  @IsArray({
    message: 'Danh sách bản dịch phải là một mảng.',
  })
  @ArrayMinSize(1, {
    message: 'Phải có ít nhất một bản dịch danh mục.',
  })
  @ArrayUnique(
    (translation: CategoryGroupTranslationDto) => translation.languageId,
    {
      message:
        'Mỗi ngôn ngữ chỉ được xuất hiện một lần trong danh sách bản dịch.',
    },
  )
  @ValidateNested({
    each: true,
  })
  @Type(() => CategoryGroupTranslationDto)
  translations!: CategoryGroupTranslationDto[];
}
