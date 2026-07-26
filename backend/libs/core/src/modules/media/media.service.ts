/// <reference types="multer" />
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaService } from '@app/core';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Upload file và lưu thông tin Media vào database.
   *
   * Việc kiểm tra quyền sở hữu bài viết được thực hiện
   * trong BlogownerMediaService.
   */
async uploadMedia(
  postId: number,
  file: Express.Multer.File,
) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      throw new NotFoundException(
        'Bài viết không tồn tại hoặc đã bị xóa',
      );
    }

    if (!file) {
      throw new BadRequestException(
        'Vui lòng chọn file cần tải lên',
      );
    }

    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');

    if (!isImage && !isVideo) {
      throw new BadRequestException(
        'Chỉ hỗ trợ tải lên file ảnh hoặc video',
      );
    }
    const mediaType: MediaType = isImage ? MediaType.IMAGE : MediaType.VIDEO;
    try {
      const uploadedResult =
        await this.cloudinary.uploadFile(
          file,
          `nestjs_blog/posts/${postId}`,
        );

      return await this.prisma.media.create({
        data: {
          postId,
          mediaType,
          mediaUrl: uploadedResult.secure_url,
          publicId: uploadedResult.public_id,
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Lỗi không xác định';

      throw new BadRequestException(
        `Lỗi khi upload file: ${message}`,
      );
    }
  }

  /**
   * Xóa file khỏi Cloudinary và database.
   *
   * Việc kiểm tra quyền sở hữu được thực hiện
   * trước khi gọi method này.
   */
  async deleteMedia(mediaId: number) {
    const media =
      await this.prisma.media.findUnique({
        where: {
          id: mediaId,
        },
      });

    if (!media) {
      throw new NotFoundException(
        'Media không tồn tại',
      );
    }

    try {
      if (media.publicId) {
        const resourceType =
          String(media.mediaType).toLowerCase() ===
          'video'
            ? 'video'
            : 'image';

        await this.cloudinary.deleteFile(
          media.publicId,
          resourceType,
        );
      }

      await this.prisma.media.delete({
        where: {
          id: mediaId,
        },
      });

      return {
        message: 'Đã xóa media thành công',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Lỗi không xác định';

      throw new BadRequestException(
        `Lỗi khi xóa media: ${message}`,
      );
    }
  }
}