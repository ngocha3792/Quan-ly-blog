import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSecurityLogsDto {
    @IsOptional()
    @Type(() => Number)
    userId?: number;

    @IsOptional()
    @IsString()
    action?: string;

    @IsOptional()
    @IsString()
    ipAddress?: string;

    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
