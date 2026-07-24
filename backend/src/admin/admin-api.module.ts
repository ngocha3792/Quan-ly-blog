import { Module } from '@nestjs/common';

import { UsersModule, PrismaModule } from '@app/core';
import { AdminUsersController } from './controllers/admin-users.controller';

@Module({
  imports: [

    PrismaModule,
    UsersModule,
  ],
  controllers: [AdminUsersController],
  providers: [],
})
export class AdminApiModule {}
