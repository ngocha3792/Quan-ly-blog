import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '@prisma/client';

export class ChangeUserRoleDto {
  @IsEnum(UserRole, { message: 'Vai trò (role) không hợp lệ' })
  @IsNotEmpty({ message: 'Vai trò không được để trống' })
  role: UserRole;
}
