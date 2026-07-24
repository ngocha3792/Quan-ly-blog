import { Module } from '@nestjs/common';

import { UsersModule, PrismaModule, AuthsModule } from '@app/core';
import { UserProfileController } from './controllers/user-profile.controller';
import { UserAuthController } from './controllers/user-auth.controller';

@Module({
  imports: [

    PrismaModule,
    UsersModule,
    AuthsModule,
  ],
  controllers: [UserProfileController, UserAuthController],
  providers: [],
})
export class UserApiModule {}
