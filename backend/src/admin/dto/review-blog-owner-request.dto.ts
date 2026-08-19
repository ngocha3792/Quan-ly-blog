import { IsIn, IsNotEmpty, ValidateIf } from 'class-validator';
import { BlogOwnerRequestStatus } from '@prisma/client';
import { UpdateBlogOwnerRequestDto } from '@app/core';

/**
 * DTO duyệt hoặc từ chối yêu cầu làm Blog Owner từ Admin.
 * Kế thừa UpdateBlogOwnerRequestDto và ghi đè các ràng buộc chi tiết:
 * - Trạng thái chỉ chấp nhận APPROVED hoặc REJECTED.
 * - Nếu REJECTED: Bắt buộc phải nhập rejectionReason.
 */
export class ReviewBlogOwnerRequestDto extends UpdateBlogOwnerRequestDto {
  @IsIn([BlogOwnerRequestStatus.APPROVED, BlogOwnerRequestStatus.REJECTED], {
    message: 'Trạng thái xử lý chỉ được phép là APPROVED hoặc REJECTED.',
  })
  declare status: BlogOwnerRequestStatus;

  @ValidateIf(
    (o: ReviewBlogOwnerRequestDto) =>
      o.status === BlogOwnerRequestStatus.REJECTED,
  )
  @IsNotEmpty({
    message: 'Lý do từ chối không được để trống khi từ chối yêu cầu.',
  })
  declare rejectionReason?: string;
}
