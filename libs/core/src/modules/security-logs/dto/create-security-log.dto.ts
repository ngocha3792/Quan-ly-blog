import { IsNotEmpty, IsNumber, IsString, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSecurityLogDto {
    @IsOptional()
    @IsNumber({}, { message: 'Mã người dùng phải là một số' })
    @Type(() => Number)
    userId?: number;

    @IsString()
    @IsNotEmpty({ message: 'Địa chỉ IP không được để trống' })
    @MaxLength(45, { message: 'Địa chỉ IP quá dài' }) // Hỗ trợ độ dài IPv6
    ipAddress: string;

    @IsString()
    @IsNotEmpty({ message: 'Hành động không được để trống' })
    @MaxLength(255, { message: 'Hành động quá dài' })
    action: string;

    @IsOptional()
    @IsString()
    userAgent?: string;
}
