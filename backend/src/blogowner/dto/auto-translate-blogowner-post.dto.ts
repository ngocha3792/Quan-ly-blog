import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class AutoTranslateBlogownerPostDto {
  @IsInt({
    message: 'Mã ngôn ngữ đích phải là số nguyên',
  })
  @Type(() => Number)
  targetLanguageId!: number;
}