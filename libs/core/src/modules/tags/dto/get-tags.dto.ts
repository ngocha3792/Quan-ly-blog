import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class GetTagsDto {
    @IsOptional()
    @IsString()
    @IsProfanityFree()
    search?: string;

    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
