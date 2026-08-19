import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class GetCommentRepliesDto {
  /**
   * ID của reply cuối cùng frontend đã nhận.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Cursor phải là số nguyên.',
  })
  @Min(1, {
    message: 'Cursor phải lớn hơn hoặc bằng 1.',
  })
  cursor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Limit phải là số nguyên.',
  })
  @Min(1, {
    message: 'Limit phải lớn hơn hoặc bằng 1.',
  })
  @Max(50, {
    message: 'Limit không được vượt quá 50.',
  })
  limit: number = 20;
}
