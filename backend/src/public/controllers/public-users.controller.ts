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
    RegisterDto,
    LoginDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    Public
} from '@app/core';

@Controller('/')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicUsersController {
    constructor(
        private readonly authsService: AuthsService,
    ) { }

    @Public()
    @Post('register')
    register(@Body() registerDto: RegisterDto) {
        return this.authsService.register(registerDto);
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(
        @Body() loginDto: LoginDto,
        @Ip() ip: string,
        @Headers('user-agent') userAgent: string
    ) {
        return this.authsService.login(loginDto, ip, userAgent);
    }

    @Public()
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authsService.forgotPassword(forgotPasswordDto);
    }

    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return this.authsService.resetPassword(resetPasswordDto);
    }
}
