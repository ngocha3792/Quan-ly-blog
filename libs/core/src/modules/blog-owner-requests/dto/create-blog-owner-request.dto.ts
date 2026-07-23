import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateBlogOwnerRequestDto {
    @IsString()
    @IsNotEmpty({ message: 'Lý do đăng ký không được để trống' })
    @MaxLength(1000, { message: 'Lý do quá dài (tối đa 1000 ký tự)' })
    reason: string;

    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Chủ đề quá dài (tối đa 500 ký tự)' })
    topics?: string;
}
