import { UpdateBlogOwnerRequestDto } from '@app/core';

/**
 * DTO duyệt/từ chối yêu cầu làm Blog Owner từ Admin.
 * Kế thừa UpdateBlogOwnerRequestDto từ core (đã có validation cho status và rejectionReason).
 */
export class ReviewBlogOwnerRequestDto extends UpdateBlogOwnerRequestDto {}
