/// <reference types="multer" />
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  UsersService,
  UserNotFoundException,
  CloudinaryService,
} from '@app/core';
import { UserProfileEntity } from '../entities';
import type { UpdateProfileDto } from '../dto';

@Injectable()
export class UserProfileService {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async getProfile(userId: number): Promise<UserProfileEntity> {
    const userData = await this.usersService.findById(userId, {
      following: {
        include: {
          follower: true,
        },
      },
    });
    if (!userData) {
      throw new UserNotFoundException(userId.toString());
    }
    return new UserProfileEntity(userData);
  }

  async updateProfile(
    userId: number,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserProfileEntity> {
    const updatedUser = await this.usersService.update(userId, updateProfileDto);
    return new UserProfileEntity(updatedUser);
  }

  async removeProfile(userId: number): Promise<UserProfileEntity> {
    const removedUser = await this.usersService.remove(userId);
    return new UserProfileEntity(removedUser);
  }

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UserProfileEntity> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh cần tải lên');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Chỉ hỗ trợ tải lên file ảnh');
    }

    try {
      // Xóa ảnh cũ trên Cloudinary nếu có
      await this.deleteOldAvatar(user.avatarUrl);

      // Upload ảnh mới lên Cloudinary
      const uploadedResult = await this.cloudinary.uploadFile(
        file,
        `nestjs_blog/users/${userId}/avatar`,
      );

      const updatedUser = await this.usersService.update(userId, {
        avatarUrl: uploadedResult.secure_url,
      });

      return new UserProfileEntity(updatedUser);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw new BadRequestException(`Lỗi khi upload avatar: ${message}`);
    }
  }

  private async deleteOldAvatar(avatarUrl: string | null) {
    if (!avatarUrl || !avatarUrl.includes('/upload/')) return;
    try {
      const parts = avatarUrl.split('/upload/');
      if (parts.length > 1) {
        let path = parts[1];
        // Loại bỏ version (ví dụ: v1234567890/)
        path = path.replace(/^v\d+\//, '');
        // Loại bỏ phần mở rộng (ví dụ: .jpg, .png)
        const lastDotIndex = path.lastIndexOf('.');
        const publicId = lastDotIndex !== -1 ? path.substring(0, lastDotIndex) : path;
        if (publicId) {
          await this.cloudinary.deleteFile(publicId, 'image');
        }
      }
    } catch {
      // Bỏ qua lỗi xóa ảnh cũ để không cản trở luồng cập nhật ảnh mới
    }
  }
}
