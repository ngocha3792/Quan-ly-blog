import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PostStatus } from '@prisma/client';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class GetPostsDto {
    @IsOptional()
    @IsString()
    @IsProfanityFree()
    search?: string;

    @IsOptional()
    @Type(() => Number)
    categoryId?: number;

    @IsOptional()
    @Type(() => Number)
    languageId?: number;

    @IsOptional()
    @Type(() => Number)
    authorId?: number;

    @IsOptional()
    @Type(() => Number)
    parentPostId?: number;

    @IsOptional()
    @IsEnum(PostStatus)
    status?: PostStatus;

    @IsOptional()
    @Type(() => Number)
    tagId?: number;

    @IsOptional()
    @IsString()
    tagName?: string;

    @IsOptional()
    @Type(() => Number)
    bookmarkedByUserId?: number;

    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
