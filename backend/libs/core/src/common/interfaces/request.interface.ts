/*đóng vai trò như một Tập hợp các bản vẽ kỹ thuật của toàn bộ hệ thống.

Nhờ có TypeScript, chúng ta không phải code "mù" (kiểu dữ liệu any). Interfaces sẽ quy định hình dáng chuẩn xác của các luồng dữ liệu dùng chung trên nhiều module khác nhau.

Lưu ý quan trọng: Đừng nhầm lẫn Interface với DTO (Data Transfer Object). DTO dùng để chứa và validate dữ liệu đầu vào của API (ví dụ: CreatePostDto), thường nằm trong từng module riêng biệt. Còn Interface ở thư mục common chỉ dùng để khai báo kiểu dáng cho các thành phần cốt lõi của kiến trúc.
*/

import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

/**
 * User đã được JwtAuthGuard xác thực và gắn vào request.
 *
 * Đây KHÔNG phải Prisma User.
 */
export interface AuthenticatedUser {
  id: number;
  role: UserRole;
  email: string;
}

/**
 * Giữ alias cũ để không phải sửa toàn bộ code ngay lập tức.
 */
export type JwtPayload = AuthenticatedUser;

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
