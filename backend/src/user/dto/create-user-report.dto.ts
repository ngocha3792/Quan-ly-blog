import { OmitType } from '@nestjs/mapped-types';

import { CreateReportDto } from '@app/core';

/**
 * User chỉ gửi:
 * - reason
 * - description
 *
 * targetType và ID mục tiêu được backend lấy từ URL.
 */
export class CreateUserReportDto extends OmitType(CreateReportDto, [
  'targetType',
  'postId',
  'commentId',
] as const) {}
