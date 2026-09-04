import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UseInterceptors,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';

import {
  AuthsService,
  ForgotPasswordDto,
  LoginDto,
  Public,
  RegisterDto,
  ResetPasswordDto,
} from '@app/core';

@Controller('/')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicUsersController {
  constructor(private readonly authsService: AuthsService) {}

  @Public()
  @Post('register')
  @Throttle({
    default: {
      limit: 5,
      ttl: 10 * 60_000,
    },
  })
  register(
    @Body()
    registerDto: RegisterDto,
  ) {
    return this.authsService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  login(
    @Body()
    loginDto: LoginDto,

    @Ip()
    ip: string,

    @Headers('user-agent')
    userAgent: string,
  ) {
    return this.authsService.login(loginDto, ip, userAgent);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: 3,
      ttl: 15 * 60_000,
    },
  })
  forgotPassword(
    @Body()
    forgotPasswordDto: ForgotPasswordDto,
  ) {
    return this.authsService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: 5,
      ttl: 15 * 60_000,
    },
  })
  resetPassword(
    @Body()
    resetPasswordDto: ResetPasswordDto,
  ) {
    return this.authsService.resetPassword(resetPasswordDto);
  }
}
