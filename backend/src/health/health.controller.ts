import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness probe: tiến trình NestJS vẫn đang hoạt động. */
  @Get()
  @HttpCode(HttpStatus.OK)
  getLiveness() {
    return this.healthService.getLiveness();
  }

  /** Readiness probe: ứng dụng có thể kết nối PostgreSQL. */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  getReadiness() {
    return this.healthService.getReadiness();
  }
}
