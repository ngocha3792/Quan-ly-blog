import { Module } from '@nestjs/common';

import { UsersModule, PrismaModule } from '@app/core';
import { PublicUsersController } from './controllers/public-users.controller';

@Module({
  imports: [

    PrismaModule,
    UsersModule,
  ],
  controllers: [PublicUsersController],
  providers: [],
})
export class PublicApiModule {}
