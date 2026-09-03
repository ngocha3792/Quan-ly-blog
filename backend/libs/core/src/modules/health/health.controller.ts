import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // Chỉ kiểm tra process còn sống, không phụ thuộc database.
  // Luôn phải trả 200 kể cả khi đang maintenance.
  @Get('live')
  live() {
    return {
      status: 'ok',
      service:
        this.configService.get<string>('app.name') || 'blog-management-api',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  // Kiểm tra kết nối database. Route này vẫn đi qua MaintenanceMiddleware
  // nên sẽ trả 503 khi bật MAINTENANCE_MODE, đúng chủ đích để load balancer
  // ngừng đưa traffic vào lúc bảo trì.
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        reason: 'database_unreachable',
      });
    }

    return {
      status: 'ok',
      database: 'up',
    };
  }
}
