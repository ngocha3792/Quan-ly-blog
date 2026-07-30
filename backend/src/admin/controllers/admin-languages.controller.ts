import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles, JwtAuthGuard, RolesGuard } from '@app/core';
import { AdminLanguagesService } from '../services/admin-languages.service';
import { CreateAdminLanguageDto, UpdateAdminLanguageDto } from '../dto';

@Controller('admin/languages')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminLanguagesController {
  constructor(
    private readonly adminLanguagesService: AdminLanguagesService,
  ) { }

  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTENT_MODERATOR)
  @Get()
  findAll() {
    return this.adminLanguagesService.findAllLanguages();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.CONTENT_MODERATOR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminLanguagesService.findOneLanguage(id);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateAdminLanguageDto) {
    return this.adminLanguagesService.createLanguage(dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminLanguageDto,
  ) {
    return this.adminLanguagesService.updateLanguage(id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminLanguagesService.deleteLanguage(id);
  }
}
