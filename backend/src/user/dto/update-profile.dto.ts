import { OmitType } from '@nestjs/mapped-types';

import { UpdateUserDto } from '@app/core';

/**
 * Avatar chỉ được thay đổi thông qua multipart file upload.
 *
 * Không cho client truyền avatarUrl trực tiếp để tránh
 * bypass file validation / Cloudinary lifecycle.
 */
export class UpdateProfileDto extends OmitType(UpdateUserDto, [
  'role',
  'status',
  'avatarUrl',
] as const) {}
