import { Module } from '@nestjs/common';
import { SecurityLogsService } from './security-logs.service';

@Module({
  providers: [SecurityLogsService],
  exports: [SecurityLogsService],
})
export class SecurityLogsModule {}
