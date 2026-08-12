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
        select: {
          follower: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              bio: true,
            },
          },
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
    updateProfileDto: UpdateProfileDto = {},
    file?: Express.Multer.File,
  ): Promise<UserProfileEntity> {
    const dto = { ...updateProfileDto };

    // Không upload avatar -> giữ nguyên flow cũ
    if (!file) {
      const updatedUser = await this.usersService.update(userId, dto);
      return new UserProfileEntity(updatedUser);
    }

    // 1. Lấy user hiện tại để giữ avatar cũ
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Chỉ hỗ trợ tải lên file ảnh');
    }

    // 2. Upload ảnh mới TRƯỚC
    let uploadedResult;

    try {
      uploadedResult = await this.cloudinary.uploadFile(
        file,
        `nestjs_blog/users/${userId}/avatar`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw new BadRequestException(
        `Lỗi khi upload avatar: ${message}`,
      );
    }

    dto.avatarUrl = uploadedResult.secure_url;

    // 3. Update DB
    let updatedUser;

    try {
      updatedUser = await this.usersService.update(userId, dto);
    } catch (error) {
      // DB update fail -> xóa ảnh vừa upload để tránh orphan file
      try {
        if (uploadedResult.public_id) {
          await this.cloudinary.deleteFile(
            uploadedResult.public_id,
            'image',
          );
        }
      } catch {
        // Cleanup fail không được che mất lỗi DB gốc
      }

      throw error;
    }

    // 4. DB đã update thành công -> lúc này mới xóa avatar cũ
    if (user.avatarUrl) {
      await this.deleteOldAvatar(user.avatarUrl);
    }

    return new UserProfileEntity(updatedUser);
  }

  async removeProfile(userId: number): Promise<UserProfileEntity> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    const removedUser = await this.usersService.remove(userId);

    if (user.avatarUrl) {
      await this.deleteOldAvatar(user.avatarUrl);
    }

    return new UserProfileEntity(removedUser);
  }

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UserProfileEntity> {
    if (!file) {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new UserNotFoundException(userId.toString());
      }
      throw new BadRequestException('Vui lòng chọn file ảnh cần tải lên');
    }

    return this.updateProfile(userId, {}, file);
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
