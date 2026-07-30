import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateUserDto } from '@app/core';

/**
 * DTO tạo tài khoản Moderator bởi Admin.
 * Kế thừa CreateUserDto từ core (đã có username, email, password validation)
 * và bổ sung các thông tin phụ: bio, avatarUrl.
 */
export class CreateModeratorDto extends CreateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio không được vượt quá 500 ký tự' })
  bio?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
