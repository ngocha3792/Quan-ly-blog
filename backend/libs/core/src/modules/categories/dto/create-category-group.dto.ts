import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCategoryGroupDto {
  @IsString({ message: 'Mã nhóm danh mục phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã nhóm danh mục không được để trống' })
  @MaxLength(50, { message: 'Mã nhóm danh mục không được vượt quá 50 ký tự' })
  code: string;
}
