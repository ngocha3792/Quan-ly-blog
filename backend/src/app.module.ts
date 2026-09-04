import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { APP_GUARD } from '@nestjs/core';

import { ScheduleModule } from '@nestjs/schedule';

import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdminApiModule } from './admin/admin-api.module';

import { BlogownerApiModule } from './blogowner/blogowner-api.module';

import { ModeratorApiModule } from './moderator/moderator-api.module';

import { PublicApiModule } from './public/public-api.module';

import { UserApiModule } from './user/user-api.module';

import { LoggerMiddleware } from '@app/core/common/middlewares/logger.middleware';

import { MaintenanceMiddleware } from '@app/core/common/middlewares/maintenance.middleware';

import configs from '@app/core/config';

import { CleanupModule } from '@app/core/modules/cleanup/cleanup.module';

import { HealthModule } from '@app/core/modules/health/health.module';

import { PrismaModule } from '@app/core/core/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: configs,
    }),

    /**
     * Global coarse rate limit.
     *
     * Route nhạy cảm sẽ override
     * bằng @Throttle().
     */
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 300,
      },
    ]),

    PrismaModule,

    HealthModule,

    AdminApiModule,
    BlogownerApiModule,
    ModeratorApiModule,
    PublicApiModule,
    UserApiModule,

    ScheduleModule.forRoot(),

    CleanupModule,
  ],

  providers: [
    /**
     * Apply throttling cho toàn API.
     */
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware, MaintenanceMiddleware).forRoutes('*');
  }
}
