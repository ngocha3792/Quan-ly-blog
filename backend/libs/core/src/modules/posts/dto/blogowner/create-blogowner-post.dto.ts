import { OmitType } from '@nestjs/mapped-types';

import { CreatePostDto } from '../create-post.dto';

/**
 * Dữ liệu Blog Owner được phép gửi khi tạo bài.
 *
 * Không cho phép Blog Owner tự gửi:
 * - status: backend luôn tạo bài ở trạng thái DRAFT
 * - parentPostId: chỉ service tạo bản dịch mới được thiết lập
 */
export class CreateBlogownerPostDto extends OmitType(CreatePostDto, [
  'status',
  'parentPostId',
] as const) {}
