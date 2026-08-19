import { PartialType, PickType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { CreateUserDto } from '@app/core';

/**
 * DTO cho PATCH /admin/users/:id
 *
 * role/status không nằm ở đây vì có endpoint riêng:
 * - PATCH /admin/users/:id/role
 * - PATCH /admin/users/:id/lock
 * - PATCH /admin/users/:id/unlock
 */
export class AdminUpdateUserDto extends PartialType(
  PickType(CreateUserDto, ['password'] as const),
) {
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Bio không được vượt quá 500 ký tự',
  })
  bio?: string;

  @IsOptional()
  @IsUrl(
    {},
    {
      message: 'Avatar phải là một đường dẫn URL hợp lệ',
    },
  )
  avatarUrl?: string;
}
