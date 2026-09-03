/*Sẽ có lúc bạn cần nâng cấp Database cho Blog và muốn tạm dừng toàn bộ API mà không phải sửa code hay sập server. Chỉ cần sửa một biến trong file .env, Middleware này sẽ chặn đứng mọi Request ngay từ cổng.
 */
import {
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Liveness probe phải luôn trả lời, kể cả khi đang bảo trì,
    // để Docker/orchestrator không giết container còn sống.
    if (req.path.endsWith('/health/live')) {
      return next();
    }

    // Đọc cờ MAINTENANCE_MODE từ ConfigService thông qua namespace 'app'
    const isMaintenance = this.configService.get<boolean>(
      'app.maintenanceMode',
    );

    if (isMaintenance) {
      // Quăng lỗi 503 Service Unavailable ngay lập tức
      throw new ServiceUnavailableException(
        'Hệ thống đang được bảo trì nâng cấp. Vui lòng quay lại sau!',
      );
    }

    next();
  }
}
