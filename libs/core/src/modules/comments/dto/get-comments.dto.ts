import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetCommentsDto {
    @IsOptional()
    @Type(() => Number)
    postId?: number;

    @IsOptional()
    @Type(() => Number)
    parentId?: number;

    @IsOptional()
    @Type(() => Number)
    userId?: number;

    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
