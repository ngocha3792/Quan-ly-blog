import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
    @MaxLength(100, { message: 'Tên danh mục không được vượt quá 100 ký tự' })
    @IsProfanityFree()
    name: string;

    @IsNumber({}, { message: 'Mã ngôn ngữ phải là một số' })
    @Type(() => Number)
    @IsNotEmpty({ message: 'Mã ngôn ngữ không được để trống' })
    languageId: number;
}
