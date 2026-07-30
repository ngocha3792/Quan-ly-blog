import { Module } from '@nestjs/common';
import {
  UsersModule,
  PrismaModule,
  AuthsModule,
  BlogOwnerRequestsModule,
  LanguagesModule,
} from '@app/core';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminRequestsController } from './controllers/admin-requests.controller';
import { AdminLanguagesController } from './controllers/admin-languages.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';

import { AdminUsersService } from './services/admin-users.service';
import { AdminRequestsService } from './services/admin-requests.service';
import { AdminLanguagesService } from './services/admin-languages.service';
import { AdminDashboardService } from './services/admin-dashboard.service';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthsModule,
    BlogOwnerRequestsModule,
    LanguagesModule,
  ],
  controllers: [
    AdminUsersController,
    AdminRequestsController,
    AdminLanguagesController,
    AdminDashboardController,
  ],
  providers: [
    AdminUsersService,
    AdminRequestsService,
    AdminLanguagesService,
    AdminDashboardService,
  ],
})
export class AdminApiModule {}
