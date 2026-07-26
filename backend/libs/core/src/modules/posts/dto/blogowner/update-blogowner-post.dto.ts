import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreatePostDto } from '../create-post.dto';

/**
 * Các trường Blog Owner được phép chỉnh sửa.
 *
 * Không được sửa trực tiếp:
 * - status
 * - parentPostId
 * - languageId
 *
 * Muốn có ngôn ngữ khác phải dùng chức năng tạo bản dịch.
 */
class EditableBlogownerPostDto extends OmitType(CreatePostDto, [
  'status',
  'parentPostId',
  'languageId',
] as const) {}

export class UpdateBlogownerPostDto extends PartialType(
  EditableBlogownerPostDto,
) {}
