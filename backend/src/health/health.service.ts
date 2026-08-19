import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '@app/core';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness() {
    return {
      status: 'ok' as const,
      service: 'blog-api',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok' as const,
        database: 'up' as const,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        message: 'Database is not ready.',
      });
    }
  }
}
