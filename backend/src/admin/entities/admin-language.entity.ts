import { Exclude } from 'class-transformer';
import { LanguageEntity } from '@app/core';

/**
 * Entity ngôn ngữ dành riêng cho Admin.
 * Kế thừa từ LanguageEntity của core module.
 */
export class AdminLanguageEntity extends LanguageEntity {
  /**
   * Ẩn trường xóa mềm khỏi API response.
   */
  @Exclude()
  declare deletedAt: Date | null;

  constructor(partial: Partial<AdminLanguageEntity>) {
    super(partial);
    Object.assign(this, partial);
  }
}
