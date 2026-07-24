import { IsNotEmpty, IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { BlogOwnerRequestStatus } from '@prisma/client';

export class UpdateBlogOwnerRequestDto {
    @IsEnum(BlogOwnerRequestStatus, { message: 'Trạng thái không hợp lệ' })
    @IsNotEmpty({ message: 'Trạng thái không được để trống' })
    status: BlogOwnerRequestStatus;

    @IsOptional()
    @IsString()
    @MaxLength(1000, { message: 'Lý do từ chối quá dài' })
    rejectionReason?: string;
}
