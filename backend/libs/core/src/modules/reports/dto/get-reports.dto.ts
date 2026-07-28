import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

export class GetReportsDto {
  @IsOptional()
  @IsEnum(ReportTargetType, {
    message: 'Loại nội dung bị báo cáo không hợp lệ.',
  })
  targetType?: ReportTargetType;

  @IsOptional()
  @IsEnum(ReportStatus, {
    message: 'Trạng thái báo cáo không hợp lệ.',
  })
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportReason, {
    message: 'Lý do báo cáo không hợp lệ.',
  })
  reason?: ReportReason;

  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Mã người gửi báo cáo phải là số nguyên.',
  })
  @Min(1)
  reporterId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Mã bài viết phải là số nguyên.',
  })
  @Min(1)
  postId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Mã bình luận phải là số nguyên.',
  })
  @Min(1)
  commentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
