import { Controller, Get, Body, Patch, Delete, UseInterceptors, ClassSerializerInterceptor, UseGuards } from '@nestjs/common';

import { OmitType } from '@nestjs/mapped-types';

import { UsersService, UpdateUserDto, UserEntity, UserNotFoundException, JwtAuthGuard } from '@app/core';
import { CurrentUser } from '@app/core';
import type { JwtPayload } from '@app/core';

// DTO dành riêng cho API của User: Kế thừa mọi thứ nhưng cấm sửa 'role' và 'status'
export class UpdateProfileDto extends OmitType(UpdateUserDto, ['role', 'status'] as const) { }

@Controller('user/profile')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserProfileController {
    constructor(
        private readonly usersService: UsersService,
    ) { }

    @Get()
    async getProfile(@CurrentUser() user: JwtPayload) {
        const userData = await this.usersService.findById(Number(user.id));
        if (!userData) throw new UserNotFoundException(user.id.toString());
        return new UserEntity(userData);
    }

    @Patch()
    async updateProfile(
        @CurrentUser() user: JwtPayload,
        @Body() updateProfileDto: UpdateProfileDto,
    ) {
        return this.usersService.update(Number(user.id), updateProfileDto);
    }

    @Delete()
    async removeProfile(@CurrentUser() user: JwtPayload) {
        return this.usersService.remove(Number(user.id));
    }
}
