//Mục đích: Kiểm tra xem người dùng đã đăng nhập chưa (có JWT Token hợp lệ không).
// Đồng thời, nó sẽ đọc Decorator @Public() để quyết định xem có mở cửa cho khách vãng lai đọc bài viết mà không cần token hay không.
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JWTUtil } from '../utils';
import { AuthenticatedRequest } from '../interfaces';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private jwtUtil: JWTUtil,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        // 1. Kiểm tra xem có gắn cờ @Public() không
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        // 2. Trích xuất Request và Token từ Header
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('Không tìm thấy Access Token trong Header.');
        }

        // 3. Tiến hành xác thực qua JWTUtil
        // Nếu token hết hạn hoặc sai chữ ký, hàm verifyAccessToken sẽ tự quăng lỗi 401 (ngừng luồng chạy ngay lập tức)
        const payload = this.jwtUtil.verifyAccessToken(token);

        // 4. Nếu qua ải thành công, gắn thông tin vào Request
        // Trong JWTUtil bạn đang đóng gói payload gồm: { sub: userId, role, email }
        // Ta map lại thành user object để các chỗ khác (như @CurrentUser hay RolesGuard) dùng cho dễ
        request['user'] = {
            id: payload.sub,
            role: payload.role,
            email: payload.email,
        };

        return true;
    }

    // Hàm phụ trợ dùng để lấy chuỗi token từ header "Authorization: Bearer <token>"
    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
