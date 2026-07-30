import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PostStatus } from '@prisma/client';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class GetPostsDto {
  @IsOptional()
  @IsString()
  @IsProfanityFree()
  search?: string;

  // Lọc các bài có chứa danh mục này.
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  languageId?: number;

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  authorId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentPostId?: number;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  tagId?: number;

  @IsOptional()
  @IsString()
  tagName?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  bookmarkedByUserId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
