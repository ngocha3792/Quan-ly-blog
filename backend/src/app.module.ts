import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';

import { AdminApiModule } from './admin/admin-api.module';
import { BlogownerApiModule } from './blogowner/blogowner-api.module';
import { ModeratorApiModule } from './moderator/moderator-api.module';
import { PublicApiModule } from './public/public-api.module';
import { UserApiModule } from './user/user-api.module';

import { LoggerMiddleware } from '@app/core/common/middlewares/logger.middleware';
import { MaintenanceMiddleware } from '@app/core/common/middlewares/maintenance.middleware';
import configs from '@app/core/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupModule } from '@app/core/modules/cleanup/cleanup.module';
import { PrismaModule } from '@app/core/core/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: configs,
    }),
    PrismaModule,
    AdminApiModule,
    BlogownerApiModule,
    ModeratorApiModule,
    PublicApiModule,
    UserApiModule,

    ScheduleModule.forRoot(),
    CleanupModule,

  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Áp dụng Logger và Maintenance middleware cho toàn bộ các route
    consumer
      .apply(LoggerMiddleware, MaintenanceMiddleware)
      .forRoutes('*');
  }
}
