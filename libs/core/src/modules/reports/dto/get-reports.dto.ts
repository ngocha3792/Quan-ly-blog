import { IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportStatus, ReportTargetType, ReportReason } from '@prisma/client';

export class GetReportsDto {
    @IsOptional()
    @IsEnum(ReportTargetType)
    targetType?: ReportTargetType;

    @IsOptional()
    @IsEnum(ReportStatus)
    status?: ReportStatus;

    @IsOptional()
    @IsEnum(ReportReason)
    reason?: ReportReason;

    @IsOptional()
    @Type(() => Number)
    reporterId?: number;

    @IsOptional()
    @Type(() => Number)
    postId?: number;

    @IsOptional()
    @Type(() => Number)
    commentId?: number;

    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
