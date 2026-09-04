import { PartialType } from '@nestjs/mapped-types';

import { CreateCategoryGroupTranslationsDto } from './create-category-group-translations.dto';

/**
 * Moderator cập nhật nhóm danh mục.
 *
 * Có thể:
 * - Chỉ cập nhật code.
 * - Chỉ thêm/cập nhật các bản dịch.
 * - Cập nhật cả code và bản dịch.
 *
 * Các bản dịch không xuất hiện trong request sẽ được giữ nguyên.
 */
export class UpdateCategoryGroupTranslationsDto extends PartialType(
  CreateCategoryGroupTranslationsDto,
) {}
