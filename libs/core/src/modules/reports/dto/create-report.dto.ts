import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, ValidateIf, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportTargetType, ReportReason } from '@prisma/client';

export class CreateReportDto {
    @IsEnum(ReportTargetType, { message: 'Loại mục tiêu báo cáo không hợp lệ' })
    @IsNotEmpty({ message: 'Loại mục tiêu báo cáo không được để trống' })
    targetType: ReportTargetType;

    @ValidateIf(o => o.targetType === ReportTargetType.POST)
    @IsNumber({}, { message: 'Mã bài viết phải là một số' })
    @Type(() => Number)
    @IsNotEmpty({ message: 'Mã bài viết không được để trống khi báo cáo bài viết' })
    postId?: number;

    @ValidateIf(o => o.targetType === ReportTargetType.COMMENT)
    @IsNumber({}, { message: 'Mã bình luận phải là một số' })
    @Type(() => Number)
    @IsNotEmpty({ message: 'Mã bình luận không được để trống khi báo cáo bình luận' })
    commentId?: number;

    @IsEnum(ReportReason, { message: 'Lý do báo cáo không hợp lệ' })
    @IsNotEmpty({ message: 'Lý do báo cáo không được để trống' })
    reason: ReportReason;

    @IsOptional()
    @IsString()
    @MaxLength(1000, { message: 'Mô tả quá dài (tối đa 1000 ký tự)' })
    description?: string;
}
