import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Moderator xác nhận nội dung thực sự vi phạm.
 *
 * Sau thao tác này:
 * - Report chuyển thành RESOLVED.
 * - Post hoặc Comment bị ẩn bằng deletedAt.
 */
export class ResolveModeratorReportDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Ghi chú xử lý phải là chuỗi.',
  })
  @IsNotEmpty({
    message: 'Ghi chú xác nhận nội dung vi phạm không được để trống.',
  })
  @MaxLength(1000, {
    message: 'Ghi chú xử lý không được vượt quá 1000 ký tự.',
  })
  resolutionNote!: string;
}
