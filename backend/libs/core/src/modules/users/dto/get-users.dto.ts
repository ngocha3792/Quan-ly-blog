import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';
import { IsProfanityFree } from '@app/core/common/decorators/is-profanity-free.decorator';

export class GetUsersDto {
    @IsOptional()
    @IsString()
    @IsProfanityFree()
    search?: string;

    @IsOptional()
    @IsEnum(UserRole, { message: 'Role không hợp lệ' })
    role?: UserRole;

    @IsOptional()
    @IsEnum(UserStatus, { message: 'Status không hợp lệ' })
    status?: UserStatus;

    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    limit?: number;
}
