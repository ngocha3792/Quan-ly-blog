import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class CreateLanguageDto {
    @IsString()
    @IsNotEmpty({ message: 'Mã ngôn ngữ không được để trống' })
    @MaxLength(10, { message: 'Mã ngôn ngữ không được vượt quá 10 ký tự' })
    code: string;

    @IsString()
    @IsNotEmpty({ message: 'Tên ngôn ngữ không được để trống' })
    @MaxLength(100, { message: 'Tên ngôn ngữ không được vượt quá 100 ký tự' })
    @IsProfanityFree()
    name: string;

    @IsOptional()
    @IsString()
    flag?: string;
}
