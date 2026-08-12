import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, AuthenticatedUser } from '../interfaces';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    // Nếu không có user (chưa đăng nhập), trả về null
    if (!user) return null;

    // Nếu truyền vào một field cụ thể (ví dụ: @CurrentUser('id')), chỉ trả về field đó
    return data ? user[data] : user;
  },
);
