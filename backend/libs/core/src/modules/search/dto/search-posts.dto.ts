import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export enum SearchSortOption {
  RELEVANCE = 'RELEVANCE',
  NEWEST = 'NEWEST',
  POPULAR = 'POPULAR',
}

export class SearchPostsDto {
  @Length(2, 200)
  @IsString()
  @IsProfanityFree()
  q!: string;

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
  categoryId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  tagId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  authorId?: number;

  @IsOptional()
  @IsEnum(SearchSortOption)
  sort?: SearchSortOption;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
