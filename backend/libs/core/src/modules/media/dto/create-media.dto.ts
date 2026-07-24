import { IsNotEmpty, IsNumber, IsString, IsEnum, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType } from '@prisma/client';

export class CreateMediaDto {
    @IsNumber({}, { message: 'Mã bài viết phải là một số' })
    @Type(() => Number)
    @IsNotEmpty({ message: 'Mã bài viết không được để trống' })
    postId: number;

    @IsEnum(MediaType, { message: 'Loại media không hợp lệ' })
    @IsNotEmpty({ message: 'Loại media không được để trống' })
    mediaType: MediaType;

    @IsString()
    @IsUrl({}, { message: 'URL media không hợp lệ' })
    @IsNotEmpty({ message: 'URL media không được để trống' })
    mediaUrl: string;
}
