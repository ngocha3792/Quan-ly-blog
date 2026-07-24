import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class CreateTagDto {
    @IsString()
    @IsNotEmpty({ message: 'Tên thẻ không được để trống' })
    @MaxLength(100, { message: 'Tên thẻ không được vượt quá 100 ký tự' })
    @IsProfanityFree()
    name: string;
}
