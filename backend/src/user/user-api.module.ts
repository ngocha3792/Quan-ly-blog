import { Module } from '@nestjs/common';

import {
  AuthsModule,
  CommentsModule,
  PrismaModule,
  UsersModule,
} from '@app/core';

import { UserAuthController } from './controllers/user-auth.controller';
import { UserCommentsController } from './controllers/user-comments.controller';
import { UserProfileController } from './controllers/user-profile.controller';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthsModule,
    CommentsModule,
  ],

  controllers: [
    UserProfileController,
    UserAuthController,
    UserCommentsController,
  ],

  providers: [],
})
export class UserApiModule {}