import { IsNotEmpty, IsNumber, IsString, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class CreateCommentDto {
    @IsNumber({}, { message: 'Mã bài viết phải là một số' })
    @Type(() => Number)
    @IsNotEmpty({ message: 'Mã bài viết không được để trống' })
    postId: number;

    @IsOptional()
    @IsNumber({}, { message: 'Mã bình luận cha phải là một số' })
    @Type(() => Number)
    parentId?: number;

    @IsString()
    @IsNotEmpty({ message: 'Nội dung bình luận không được để trống' })
    @MaxLength(1000, { message: 'Nội dung bình luận quá dài (tối đa 1000 ký tự)' })
    @IsProfanityFree()
    content: string;
}
