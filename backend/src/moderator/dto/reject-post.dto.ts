import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Dữ liệu Moderator gửi khi từ chối bài viết.
 *
 * Không dùng IsProfanityFree vì Moderator có thể cần
 * trích dẫn hoặc mô tả chính xác nội dung vi phạm.
 */
export class RejectModeratorPostDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Lý do từ chối phải là chuỗi.',
  })
  @IsNotEmpty({
    message: 'Lý do từ chối bài viết không được để trống.',
  })
  @MaxLength(2000, {
    message: 'Lý do từ chối không được vượt quá 2000 ký tự.',
  })
  rejectionReason!: string;
}
