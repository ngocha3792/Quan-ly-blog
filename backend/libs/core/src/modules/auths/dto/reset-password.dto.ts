import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'Token không được để trống' })
    token: string;

    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
    @MinLength(6, { message: 'Mật khẩu phải dài ít nhất 6 ký tự' })
    newPassword: string;
}
