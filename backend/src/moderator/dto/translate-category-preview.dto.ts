import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { IsProfanityFree } from '@app/core';

export class TranslateCategoryPreviewDto {
  @Type(() => Number)
  @IsInt({
    message: 'Mã ngôn ngữ nguồn phải là số nguyên.',
  })
  @Min(1, {
    message: 'Mã ngôn ngữ nguồn phải lớn hơn hoặc bằng 1.',
  })
  sourceLanguageId!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Tên danh mục nguồn phải là chuỗi.',
  })
  @IsNotEmpty({
    message: 'Tên danh mục nguồn không được để trống.',
  })
  @MaxLength(100, {
    message: 'Tên danh mục nguồn không được vượt quá 100 ký tự.',
  })
  @IsProfanityFree()
  sourceName!: string;

  @IsArray({
    message: 'Danh sách ngôn ngữ đích phải là một mảng.',
  })
  @ArrayMinSize(1, {
    message: 'Phải chọn ít nhất một ngôn ngữ đích.',
  })
  @ArrayUnique(undefined , {
    message: 'Mỗi ngôn ngữ đích chỉ được xuất hiện một lần.',
  })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: 'Mã ngôn ngữ đích phải là số nguyên.',
  })
  @Min(1, {
    each: true,
    message: 'Mã ngôn ngữ đích phải lớn hơn hoặc bằng 1.',
  })
  targetLanguageIds!: number[];
}