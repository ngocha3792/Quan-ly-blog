import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetBlogownerDashboardActivityDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Số ngày thống kê phải là số nguyên',
  })
  @Min(1, {
    message: 'Số ngày thống kê phải từ 1 ngày trở lên',
  })
  @Max(30, {
    message: 'Số ngày thống kê không được vượt quá 30 ngày',
  })
  days = 7;
}