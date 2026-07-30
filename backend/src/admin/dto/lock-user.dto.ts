import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LockUserDto {
  @IsString({ message: 'Lý do khóa phải là chuỗi' })
  @IsNotEmpty({ message: 'Lý do khóa tài khoản không được để trống' })
  @MaxLength(500, { message: 'Lý do khóa tài khoản không được vượt quá 500 ký tự' })
  reason: string;
}
