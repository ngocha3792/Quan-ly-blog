import { IsNotEmpty, IsNumber, IsString, MaxLength, IsOptional, IsEnum, IsUrl, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { PostStatus } from '@prisma/client';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class CreatePostDto {
    @IsString()
    @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
    @MaxLength(255, { message: 'Tiêu đề không được vượt quá 255 ký tự' })
    @IsProfanityFree()
    title: string;

    @IsOptional()
    @IsString()
    @IsUrl({}, { message: 'URL ảnh đại diện không hợp lệ' })
    thumbnailUrl?: string;

    @IsString()
    @IsNotEmpty({ message: 'Nội dung không được để trống' })
    @IsProfanityFree()
    content: string;

    @IsOptional()
    @IsEnum(PostStatus, { message: 'Trạng thái bài viết không hợp lệ' })
    status?: PostStatus;

    @IsOptional()
    @IsNumber({}, { message: 'Mã bài viết cha phải là một số' })
    @Type(() => Number)
    parentPostId?: number;

    @IsNumber({}, { message: 'Mã danh mục phải là một số' })
    @Type(() => Number)
    @IsNotEmpty({ message: 'Mã danh mục không được để trống' })
    categoryId: number;

    @IsNumber({}, { message: 'Mã ngôn ngữ phải là một số' })
    @Type(() => Number)
    @IsNotEmpty({ message: 'Mã ngôn ngữ không được để trống' })
    languageId: number;

    @IsOptional()
    @IsArray({ message: 'Danh sách thẻ phải là một mảng' })
    @IsNumber({}, { each: true, message: 'Mã thẻ phải là một số' })
    @Type(() => Number)
    tagIds?: number[];

    @IsOptional()
    @IsArray({ message: 'Danh sách tên thẻ (tạo mới) phải là một mảng' })
    @IsString({ each: true, message: 'Tên thẻ phải là chuỗi' })
    tagNames?: string[];
}
