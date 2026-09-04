import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty({
    message: 'Nội dung bình luận không được để trống',
  })
  @MaxLength(1000, {
    message: 'Nội dung bình luận quá dài (tối đa 1000 ký tự)',
  })
  @IsProfanityFree()
  content!: string;
}
