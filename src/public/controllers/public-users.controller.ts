import { Controller, Post, Body, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';

import { UsersService, CreateUserDto, Public } from '@app/core';

@Controller('public/users')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicUsersController {
    constructor(
        private readonly usersService: UsersService,
    ) { }

    @Public()
    @Post()
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }
}
