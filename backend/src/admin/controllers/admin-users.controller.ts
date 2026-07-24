import { Controller, Get, Body, Patch, Param, Delete, Query, ParseIntPipe, UseInterceptors, ClassSerializerInterceptor, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { UsersService, UpdateUserDto, GetUsersDto, UserEntity } from '@app/core';
import { UserNotFoundException } from '@app/core';

import { Pagination, Roles } from '@app/core';
import type { PaginationParams } from '@app/core';

import { JwtAuthGuard, RolesGuard } from '@app/core';

@Controller('/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminUsersController {
    constructor(
        private readonly usersService: UsersService,
    ) { }

    @Roles(UserRole.SUPER_ADMIN)
    @Get()
    findAll(
        @Query() getUsersDto: GetUsersDto,
        @Pagination() paginationParams: PaginationParams,
    ) {
        return this.usersService.findAll(getUsersDto, paginationParams);
    }

    @Roles(UserRole.SUPER_ADMIN)
    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number) {
        const user = await this.usersService.findById(id);
        if (!user) throw new UserNotFoundException(id.toString());
        return new UserEntity(user);
    }

    @Roles(UserRole.SUPER_ADMIN)
    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateUserDto: UpdateUserDto,
    ) {
        return this.usersService.update(id, updateUserDto);
    }

    @Roles(UserRole.SUPER_ADMIN)
    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.remove(id);
    }
}
