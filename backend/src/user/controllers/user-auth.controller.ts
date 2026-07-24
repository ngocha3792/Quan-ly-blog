import { 
    Controller, 
    Post, 
    Body, 
    UseInterceptors, 
    ClassSerializerInterceptor,
    Ip,
    Headers,
    HttpCode,
    HttpStatus
} from '@nestjs/common';

import { 
    AuthsService, 
    RefreshTokenDto,
    CurrentUser
} from '@app/core';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class UserAuthController {
    constructor(
        private readonly authsService: AuthsService,
    ) { }

    @Post('refresh-token')
    @HttpCode(HttpStatus.OK)
    refreshToken(
        @Body() refreshTokenDto: RefreshTokenDto,
        @Ip() ip: string,
        @Headers('user-agent') userAgent: string
    ) {
        return this.authsService.refreshToken(refreshTokenDto, ip, userAgent);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    logout(@Body() refreshTokenDto: RefreshTokenDto) {
        return this.authsService.logout(refreshTokenDto);
    }

    @Post('logout-all')
    @HttpCode(HttpStatus.OK)
    logoutAll(@CurrentUser() user: any) {
        const userId = parseInt(user?.sub || user?.id, 10);
        return this.authsService.logoutAll(userId);
    }
}
