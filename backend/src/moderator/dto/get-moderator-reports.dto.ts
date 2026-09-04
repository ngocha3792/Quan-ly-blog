import { GetReportsDto } from '@app/core';

/**
 * Bộ lọc danh sách báo cáo dành cho Moderator.
 *
 * Mặc định service sẽ lấy report PENDING.
 */
export class GetModeratorReportsDto extends GetReportsDto {}
