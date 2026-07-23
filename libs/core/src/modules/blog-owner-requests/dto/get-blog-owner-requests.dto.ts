import { IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { BlogOwnerRequestStatus } from '@prisma/client';

export class GetBlogOwnerRequestsDto {
    @IsOptional()
    @Type(() => Number)
    userId?: number;

    @IsOptional()
    @IsEnum(BlogOwnerRequestStatus)
    status?: BlogOwnerRequestStatus;

    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
