import { Module } from '@nestjs/common';

import {
  AuthsModule,
  CommentsModule,
  PrismaModule,
  ReportsModule,
  UsersModule,
} from '@app/core';

import { UserAuthController } from './controllers/user-auth.controller';
import { UserCommentsController } from './controllers/user-comments.controller';
import { UserProfileController } from './controllers/user-profile.controller';
import { UserReportsController } from './controllers/user-reports.controller';

import { UserReportsService } from './services/user-reports.service';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthsModule,
    CommentsModule,
    ReportsModule,
  ],

  controllers: [
    UserProfileController,
    UserAuthController,
    UserCommentsController,
    UserReportsController,
  ],

  providers: [
    UserReportsService,
  ],
})
export class UserApiModule {}