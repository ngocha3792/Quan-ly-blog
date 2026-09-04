import { OmitType } from '@nestjs/mapped-types';

import { CreateCommentDto } from '@app/core';

/**
 * Khi tạo comment, postId được lấy từ URL:
 *
 * POST /user/posts/:postId/comments
 *
 * Client không được tự gửi postId trong body.
 */
export class CreateUserCommentDto extends OmitType(CreateCommentDto, [
  'postId',
] as const) {}
