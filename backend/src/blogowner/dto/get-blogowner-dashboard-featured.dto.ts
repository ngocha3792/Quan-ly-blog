import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const BLOGOWNER_FEATURED_SORTS = [
  'views',
  'likes',
] as const;

export type BlogownerFeaturedSort =
  (typeof BLOGOWNER_FEATURED_SORTS)[number];

export class GetBlogownerDashboardFeaturedDto {
  @IsOptional()
  @IsIn(BLOGOWNER_FEATURED_SORTS, {
    message: 'Tiêu chí sắp xếp phải là views hoặc likes',
  })
  sort: BlogownerFeaturedSort = 'views';

  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Giới hạn bài viết phải là số nguyên',
  })
  @Min(1, {
    message: 'Giới hạn bài viết phải từ 1 trở lên',
  })
  @Max(20, {
    message: 'Giới hạn bài viết không được vượt quá 20',
  })
  limit = 5;
}