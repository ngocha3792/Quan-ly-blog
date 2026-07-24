import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsUrl, IsEnum } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

// 1. Vứt bỏ 'email' và 'username' khỏi CreateUserDto
// 2. Dùng PartialType để biến 'password' thành trường không bắt buộc (Optional)
export class UpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['email', 'username'] as const),
) {
    @IsOptional()
    @IsString()
    bio?: string;

    @IsOptional()
    @IsUrl({}, { message: 'Avatar phải là một đường dẫn URL hợp lệ' })
    avatarUrl?: string;

    @IsOptional()
    @IsEnum(UserRole, { message: 'Role không hợp lệ' })
    role?: UserRole;

    @IsOptional()
    @IsEnum(UserStatus, { message: 'Trạng thái không hợp lệ' })
    status?: UserStatus;
}
