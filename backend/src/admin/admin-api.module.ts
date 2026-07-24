import { Module } from '@nestjs/common';

import { UsersModule, PrismaModule, AuthsModule } from '@app/core';
import { AdminUsersController } from './controllers/admin-users.controller';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthsModule,
  ],
  controllers: [AdminUsersController],
  providers: [],
})
export class AdminApiModule {}
