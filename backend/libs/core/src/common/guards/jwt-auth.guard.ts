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
import { UserStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JWTUtil } from '../utils';
import { AuthenticatedRequest } from '../interfaces';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtUtil: JWTUtil,
    private prisma: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Kiểm tra xem có gắn cờ @Public() không, nếu có cờ public mặc định cho qua không cần kiểm tra JWT
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
      throw new UnauthorizedException(
        'Không tìm thấy Access Token trong Header.',
      );
    }

    // 3. Tiến hành xác thực qua JWTUtil
    // Nếu token hết hạn hoặc sai chữ ký, hàm verifyAccessToken sẽ tự quăng lỗi 401 (ngừng luồng chạy ngay lập tức)
    const payload = this.jwtUtil.verifyAccessToken(token);
    const userId = parseInt(payload.sub, 10);

    // 4. Kiểm tra sự tồn tại và trạng thái tài khoản trong DB
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị xóa.',
      );
    }

    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException(
        user.lockReason
          ? `Tài khoản đã bị khóa: ${user.lockReason}`
          : 'Tài khoản của bạn đã bị khóa.',
      );
    }

    // 5. Nếu qua ải thành công, gắn thông tin cập nhật mới nhất từ DB vào Request
    request['user'] = {
      id: user.id.toString(),
      role: user.role,
      email: user.email,
    };

    return true;
  }

  // Hàm phụ trợ dùng để lấy chuỗi token từ header "Authorization: Bearer <token>"
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
