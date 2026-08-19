import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { BcryptUtil } from '@app/core/common/utils';

@Module({
  controllers: [],
  providers: [UsersService, BcryptUtil],
  exports: [UsersService, BcryptUtil], // Export ra ngoài để các Module khác có thể gọi
})
export class UsersModule {}
