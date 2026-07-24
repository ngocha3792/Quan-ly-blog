/*đóng vai trò như một Tập hợp các bản vẽ kỹ thuật của toàn bộ hệ thống.

Nhờ có TypeScript, chúng ta không phải code "mù" (kiểu dữ liệu any). Interfaces sẽ quy định hình dáng chuẩn xác của các luồng dữ liệu dùng chung trên nhiều module khác nhau.

Lưu ý quan trọng: Đừng nhầm lẫn Interface với DTO (Data Transfer Object). DTO dùng để chứa và validate dữ liệu đầu vào của API (ví dụ: CreatePostDto), thường nằm trong từng module riêng biệt. Còn Interface ở thư mục common chỉ dùng để khai báo kiểu dáng cho các thành phần cốt lõi của kiến trúc.
*/

import { Request } from 'express';

// Hình dáng của User sau khi được JwtAuthGuard giải mã
export interface JwtPayload {
    id: string;
    role: string;
    email: string;
}

// Mở rộng Request mặc định của Express, nhét thêm cục user vào
export interface AuthenticatedRequest extends Request {
    user: JwtPayload;
}

