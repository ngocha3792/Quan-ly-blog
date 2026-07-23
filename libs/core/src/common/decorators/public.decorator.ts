// Mục đích: Đánh dấu API không cần bảo vệ, cho phép khách vãng lai (guest) truy cập mà không cần mang theo Token.
import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = 'ispublic'

// Gắn một cờ (flag) isPublic = true lên Controller/Hàm
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
