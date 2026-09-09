import { IsUUID } from 'class-validator';

export class RecordPostViewDto {
  /**
   * ID ngẫu nhiên đại diện cho browser profile.
   *
   * FE tạo bằng crypto.randomUUID() và lưu localStorage.
   *
   * - Các tab thường cùng browser dùng chung visitorId.
   * - Incognito có visitorId riêng.
   * - Nếu request có access token hợp lệ, backend ưu tiên userId
   *   và visitorId chỉ đóng vai trò fallback.
   */
  @IsUUID('4', {
    message: 'visitorId phải là UUID hợp lệ.',
  })
  visitorId!: string;
}