import { IsNotEmpty, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class FollowUserDto {
    @IsNumber({}, { message: 'ID người dùng phải là một số' })
    @Type(() => Number)
    @IsNotEmpty({ message: 'ID người dùng cần follow không được để trống' })
    followingId: number;
}
