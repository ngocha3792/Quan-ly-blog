import { Type } from 'class-transformer';
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

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(255, { message: 'Tiêu đề không được vượt quá 255 ký tự' })
  @IsProfanityFree()
  title!: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'URL ảnh đại diện không hợp lệ' })
  thumbnailUrl?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  @IsProfanityFree()
  content!: string;

  @IsOptional()
  @IsEnum(PostStatus, { message: 'Trạng thái bài viết không hợp lệ' })
  status?: PostStatus;

  @IsOptional()
  @IsInt({ message: 'Mã bài viết cha phải là số nguyên' })
  @Type(() => Number)
  parentPostId?: number;

  @IsArray({ message: 'Danh sách danh mục phải là một mảng' })
  @ArrayMinSize(1, { message: 'Bài viết phải có ít nhất một danh mục' })
  @ArrayUnique({ message: 'Danh sách danh mục không được chứa mã trùng nhau' })
  @IsInt({ each: true, message: 'Mỗi mã danh mục phải là số nguyên' })
  @Type(() => Number)
  categoryIds!: number[];

  @IsInt({ message: 'Mã ngôn ngữ phải là số nguyên' })
  @Type(() => Number)
  languageId!: number;

  @IsOptional()
  @IsArray({ message: 'Danh sách thẻ phải là một mảng' })
  @ArrayUnique({ message: 'Danh sách thẻ không được chứa mã trùng nhau' })
  @IsInt({ each: true, message: 'Mỗi mã thẻ phải là số nguyên' })
  @Type(() => Number)
  tagIds?: number[];

  @IsOptional()
  @IsArray({ message: 'Danh sách tên thẻ phải là một mảng' })
  @ArrayUnique({ message: 'Danh sách tên thẻ không được trùng nhau' })
  @IsString({ each: true, message: 'Tên thẻ phải là chuỗi' })
  tagNames?: string[];
}
