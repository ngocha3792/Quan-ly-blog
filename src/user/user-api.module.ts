import { Module } from '@nestjs/common';

import { UsersModule, PrismaModule } from '@app/core';
import { UserProfileController } from './controllers/user-profile.controller';

@Module({
  imports: [

    PrismaModule,
    UsersModule,
  ],
  controllers: [UserProfileController],
  providers: [],
})
export class UserApiModule {}
