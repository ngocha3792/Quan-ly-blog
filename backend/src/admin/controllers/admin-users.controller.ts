import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
  UseGuards,
} from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';

import {
  UsersService,
  UpdateUserDto,
  GetUsersDto,
  Pagination,
  Roles,
  CurrentUser,
  JwtAuthGuard,
  RolesGuard,
} from '@app/core';
import type { PaginationParams } from '@app/core';
import { AdminUsersService } from '../services/admin-users.service';
import { CreateModeratorDto, LockUserDto, ChangeUserRoleDto } from '../dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly usersService: UsersService,
  ) { }

  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  findAll(
    @Query() getUsersDto: GetUsersDto,
    @Pagination() paginationParams: PaginationParams,
  ) {
    return this.adminUsersService.findAll(getUsersDto, paginationParams);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('/moderators')
  createModerator(@Body() createModeratorDto: CreateModeratorDto) {
    return this.adminUsersService.createModerator(createModeratorDto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersService.findOne(id);
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
  @Patch(':id/lock')
  lockUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() adminUser: User,
    @Body() lockUserDto: LockUserDto,
  ) {
    return this.adminUsersService.lockUser(id, adminUser.id, lockUserDto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/unlock')
  unlockUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() adminUser: User,
  ) {
    return this.adminUsersService.unlockUser(id, adminUser.id);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/role')
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() adminUser: User,
    @Body() changeUserRoleDto: ChangeUserRoleDto,
  ) {
    return this.adminUsersService.changeRole(
      id,
      adminUser.id,
      changeUserRoleDto,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() adminUser: User,
  ) {
    return this.adminUsersService.removeUser(id, adminUser.id);
  }
}
