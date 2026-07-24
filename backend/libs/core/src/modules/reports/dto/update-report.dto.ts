import { IsNotEmpty, IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class UpdateReportDto {
    @IsEnum(ReportStatus, { message: 'Trạng thái báo cáo không hợp lệ' })
    @IsNotEmpty({ message: 'Trạng thái báo cáo không được để trống' })
    status: ReportStatus;

    @IsOptional()
    @IsString()
    @MaxLength(1000, { message: 'Ghi chú xử lý quá dài' })
    resolutionNote?: string;
}
