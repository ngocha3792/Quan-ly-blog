/// <reference types="multer" />

import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  CloudinaryService,
  UserNotFoundException,
  UsersService,
} from '@app/core';

import {
  UserProfileEntity,
} from '../entities';

import type {
  UpdateProfileDto,
} from '../dto';

const MAX_AVATAR_SIZE =
  5 * 1024 * 1024;

type SupportedAvatarMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

@Injectable()
export class UserProfileService {
  constructor(
    private readonly usersService:
      UsersService,

    private readonly cloudinary:
      CloudinaryService,
  ) {}

  async getProfile(
    userId: number,
  ): Promise<UserProfileEntity> {
    const userData =
      await this.usersService.findById(
        userId,
        {
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
        },
      );

    if (!userData) {
      throw new UserNotFoundException(
        userId.toString(),
      );
    }

    return new UserProfileEntity(
      userData,
    );
  }

  async updateProfile(
    userId: number,
    updateProfileDto:
      UpdateProfileDto = {},
    file?: Express.Multer.File,
  ): Promise<UserProfileEntity> {
    /**
     * Không đổi avatar.
     */
    if (!file) {
      const updatedUser =
        await this.usersService.update(
          userId,
          updateProfileDto,
        );

      return new UserProfileEntity(
        updatedUser,
      );
    }

    const user =
      await this.usersService.findById(
        userId,
      );

    if (!user) {
      throw new UserNotFoundException(
        userId.toString(),
      );
    }

    /**
     * Không tin:
     *
     * file.mimetype
     * file.originalname
     *
     * vì cả hai đều đến từ client.
     */
    this.validateAvatarFile(file);

    let uploadedResult;

    try {
      uploadedResult =
        await this.cloudinary.uploadFile(
          file,
          `nestjs_blog/users/${userId}/avatar`,
        );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Lỗi không xác định';

      throw new BadRequestException(
        `Lỗi khi upload avatar: ${message}`,
      );
    }

    /**
     * Cloudinary resource phải có cả URL
     * và public_id.
     *
     * Nếu không có public_id thì sau này
     * không quản lý lifecycle resource được.
     */
    if (
      !uploadedResult.secure_url ||
      !uploadedResult.public_id
    ) {
      /**
       * Nếu Cloudinary trả public_id nhưng thiếu URL,
       * cố cleanup resource vừa upload.
       */
      if (
        uploadedResult.public_id
      ) {
        try {
          await this.cloudinary.deleteFile(
            uploadedResult.public_id,
            'image',
          );
        } catch {
          // Không che lỗi chính.
        }
      }

      throw new BadRequestException(
        'Cloudinary không trả về thông tin avatar hợp lệ.',
      );
    }

    const oldAvatarPublicId =
      (user as { avatarPublicId?: string | null }).avatarPublicId;

    let updatedUser;

    try {
      /**
       * URL + publicId được update cùng một DB operation.
       */
      updatedUser =
        await this.usersService.update(
          userId,
          {
            ...updateProfileDto,

            avatarUrl:
              uploadedResult.secure_url,

            avatarPublicId:
              uploadedResult.public_id,
          },
        );
    } catch (error) {
      /**
       * Cloudinary upload thành công
       * nhưng DB fail.
       *
       * Phải xóa resource mới để tránh orphan.
       */
      try {
        await this.cloudinary.deleteFile(
          uploadedResult.public_id,
          'image',
        );
      } catch {
        /**
         * Cleanup failure không được
         * che lỗi DB ban đầu.
         */
      }

      throw error;
    }

    /**
     * DB đã trỏ sang avatar mới.
     *
     * Giờ mới an toàn để xóa avatar cũ.
     */
    if (
      oldAvatarPublicId &&
      oldAvatarPublicId !==
        uploadedResult.public_id
    ) {
      try {
        await this.cloudinary.deleteFile(
          oldAvatarPublicId,
          'image',
        );
      } catch {
        /**
         * Nếu cleanup avatar cũ thất bại,
         * profile mới vẫn hợp lệ.
         *
         * Có thể cleanup orphan sau bằng job.
         */
      }
    }

    return new UserProfileEntity(
      updatedUser,
    );
  }

  async removeProfile(
    userId: number,
  ): Promise<UserProfileEntity> {
    const user =
      await this.usersService.findById(
        userId,
      );

    if (!user) {
      throw new UserNotFoundException(
        userId.toString(),
      );
    }

    const removedUser =
      await this.usersService.remove(
        userId,
      );

    /**
     * Không parse avatarUrl.
     *
     * Chỉ dùng publicId đã lưu trong DB.
     */
    const avatarPublicId =
      (user as { avatarPublicId?: string | null }).avatarPublicId;

    if (avatarPublicId) {
      try {
        await this.cloudinary.deleteFile(
          avatarPublicId,
          'image',
        );
      } catch {
        /**
         * Soft-delete user vẫn phải thành công
         * ngay cả khi Cloudinary cleanup fail.
         */
      }
    }

    return new UserProfileEntity(
      removedUser,
    );
  }

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UserProfileEntity> {
    if (!file) {
      throw new BadRequestException(
        'Vui lòng chọn file ảnh cần tải lên',
      );
    }

    return this.updateProfile(
      userId,
      {},
      file,
    );
  }

  /**
   * Validate dựa vào nội dung binary thực tế.
   *
   * Không dùng file.mimetype làm source of truth.
   */
  private validateAvatarFile(
    file: Express.Multer.File,
  ): SupportedAvatarMime {
    if (
      !file.buffer ||
      file.buffer.length === 0
    ) {
      throw new BadRequestException(
        'File ảnh không hợp lệ.',
      );
    }

    /**
     * Defense-in-depth.
     *
     * Controller đã giới hạn 5MB bằng Multer,
     * service vẫn tự enforce để tránh bị bypass
     * nếu được gọi từ nơi khác.
     */
    if (
      file.buffer.length >
      MAX_AVATAR_SIZE
    ) {
      throw new BadRequestException(
        'Ảnh đại diện không được vượt quá 5MB.',
      );
    }

    const detectedMime =
      this.detectAvatarMime(
        file.buffer,
      );

    if (!detectedMime) {
      throw new BadRequestException(
        'Định dạng ảnh không hợp lệ. Chỉ hỗ trợ JPEG, PNG, WEBP hoặc GIF.',
      );
    }

    return detectedMime;
  }

  /**
   * Magic-byte detection.
   *
   * JPEG:
   * FF D8 FF
   *
   * PNG:
   * 89 50 4E 47 0D 0A 1A 0A
   *
   * GIF:
   * GIF87a / GIF89a
   *
   * WEBP:
   * RIFF .... WEBP
   */
  private detectAvatarMime(
    buffer: Buffer,
  ): SupportedAvatarMime | null {
    // JPEG
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return 'image/jpeg';
    }

    // PNG
    const pngSignature = [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ];

    if (
      buffer.length >=
        pngSignature.length &&
      pngSignature.every(
        (byte, index) =>
          buffer[index] === byte,
      )
    ) {
      return 'image/png';
    }

    // WEBP
    if (
      buffer.length >= 12 &&
      buffer
        .subarray(0, 4)
        .toString('ascii') ===
        'RIFF' &&
      buffer
        .subarray(8, 12)
        .toString('ascii') ===
        'WEBP'
    ) {
      return 'image/webp';
    }

    // GIF
    if (buffer.length >= 6) {
      const gifHeader =
        buffer
          .subarray(0, 6)
          .toString('ascii');

      if (
        gifHeader === 'GIF87a' ||
        gifHeader === 'GIF89a'
      ) {
        return 'image/gif';
      }
    }

    return null;
  }
}
