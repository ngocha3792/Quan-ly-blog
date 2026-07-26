import { OmitType } from '@nestjs/mapped-types';

import { GetPostsDto } from '../get-posts.dto';

/**
 * Bộ lọc danh sách bài viết của Blog Owner.
 *
 * authorId không được nhận từ query vì backend tự lấy từ JWT.
 * bookmarkedByUserId không liên quan màn hình quản lý bài.
 */
export class GetBlogownerPostsDto extends OmitType(GetPostsDto, [
  'authorId',
  'bookmarkedByUserId',
] as const) {}
