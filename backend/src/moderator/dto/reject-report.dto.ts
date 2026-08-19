import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Moderator xác định báo cáo không đúng
 * hoặc không có đủ căn cứ.
 *
 * Sau thao tác này:
 * - Report chuyển thành REJECTED.
 * - Nội dung không bị ảnh hưởng.
 */
export class RejectModeratorReportDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Ghi chú bác bỏ phải là chuỗi.',
  })
  @IsNotEmpty({
    message: 'Lý do bác bỏ báo cáo không được để trống.',
  })
  @MaxLength(1000, {
    message:
      'Ghi chú xử lý không được vượt quá 1000 ký tự.',
  })
  resolutionNote!: string;
}