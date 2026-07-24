import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty({ message: 'Username không được để trống' })
    @MaxLength(50, { message: 'Username không được vượt quá 50 ký tự' })
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username chỉ được chứa chữ cái, số và dấu gạch dưới' })
    username: string;

    @IsEmail({}, { message: 'Email không đúng định dạng' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    password: string;
}
