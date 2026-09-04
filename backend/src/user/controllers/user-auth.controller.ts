import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  ClassSerializerInterceptor,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';

import {
  AuthsService,
  RefreshTokenDto,
  CurrentUser,
  JwtAuthGuard,
} from '@app/core';
import type { AuthenticatedUser } from '@app/core';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class UserAuthController {
  constructor(private readonly authsService: AuthsService) {}

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authsService.refreshToken(refreshTokenDto, ip, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authsService.logout(refreshTokenDto);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authsService.logoutAll(user.id);
  }
}
