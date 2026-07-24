import { IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType } from '@prisma/client';

export class GetMediaDto {
    @IsOptional()
    @Type(() => Number)
    postId?: number;

    @IsOptional()
    @IsEnum(MediaType)
    mediaType?: MediaType;

    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
