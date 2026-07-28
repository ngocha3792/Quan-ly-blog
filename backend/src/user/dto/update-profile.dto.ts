import { OmitType } from '@nestjs/mapped-types';
import { UpdateUserDto } from '@app/core';

// DTO dành riêng cho API của User: Kế thừa mọi thứ nhưng cấm sửa 'role' và 'status'
export class UpdateProfileDto extends OmitType(UpdateUserDto, [
  'role',
  'status',
] as const) {}
