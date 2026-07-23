// Mục đích: Lấy thông tin user đang đăng nhập (đã được Guard gắn vào Request) để lưu làm tác giả bài viết.

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedRequest, JwtPayload } from "../interfaces";

export const CurrentUser = createParamDecorator(
    (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
        const user = request.user;
        // Nếu không có user (chưa đăng nhập), trả về null
        if (!user) return null;

        // Nếu truyền vào một field cụ thể (ví dụ: @CurrentUser('id')), chỉ trả về field đó
        return data ? user[data] : user;
    },
);
