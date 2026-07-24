import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthsService } from './auths.service';
import { UsersModule } from '../users/users.module';
import { JWTUtil, BcryptUtil } from '@app/core/common/utils';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({}),
  ],
  controllers: [],
  providers: [AuthsService, JWTUtil, BcryptUtil],
  exports: [AuthsService],
})
export class AuthsModule { }
