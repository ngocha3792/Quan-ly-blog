import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetTopQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng (limit) phải là số nguyên.' })
  @Min(1, { message: 'Số lượng (limit) phải lớn hơn hoặc bằng 1.' })
  @Max(50, { message: 'Số lượng (limit) không được vượt quá 50.' })
  limit: number = 10;

  @IsOptional()
  @IsString({ message: 'Mã ngôn ngữ (langCode) phải là chuỗi ký tự.' })
  lang?: string;
  @IsOptional()
  @IsString({ message: 'Mã ngôn ngữ (langCode) phải là chuỗi ký tự.' })
  langCode?: string;
}

