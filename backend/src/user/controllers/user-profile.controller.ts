/// <reference types="multer" />
import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  Post,
  UploadedFile,
  UseInterceptors,
  ClassSerializerInterceptor,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, CurrentUser } from '@app/core';
import type { AuthenticatedUser } from '@app/core';
import { UpdateProfileDto } from '../dto';
import { UserProfileService } from '../services/user-profile.service';

@Controller('user/profile')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get()
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userProfileService.getProfile(user.id);
  }

  @Patch()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // Giới hạn 5MB cho ảnh avatar
      },
    }),
  )
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.userProfileService.updateProfile(
      user.id,
      updateProfileDto,
      file,
    );
  }

  @Delete()
  async removeProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userProfileService.removeProfile(user.id);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // Giới hạn 5MB cho ảnh avatar
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userProfileService.uploadAvatar(user.id, file);
  }
}
