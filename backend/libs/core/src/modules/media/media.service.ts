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
  async uploadMedia(postId: number, file: Express.Multer.File) {
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
      throw new NotFoundException('Bài viết không tồn tại hoặc đã bị xóa');
    }

    if (!file) {
      throw new BadRequestException('Vui lòng chọn file cần tải lên');
    }

    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');

    if (!isImage && !isVideo) {
      throw new BadRequestException('Chỉ hỗ trợ tải lên file ảnh hoặc video');
    }
    const mediaType: MediaType = isImage ? MediaType.IMAGE : MediaType.VIDEO;
    try {
      const uploadedResult = await this.cloudinary.uploadFile(
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
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw new BadRequestException(`Lỗi khi upload file: ${message}`);
    }
  }

  /**
   * Xóa mềm media trong database và cleanup file trên Cloudinary.
   *
   * Việc kiểm tra quyền sở hữu bài viết được thực hiện
   * trong BlogownerMediaService trước khi gọi method này.
   */
  async deleteMedia(mediaId: number) {
    /**
     * Chỉ lấy media còn hoạt động.
     * Media đã soft-delete được xem như không còn tồn tại.
     */
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        deletedAt: null,
      },
    });

    if (!media) {
      throw new NotFoundException('Media không tồn tại');
    }

    /**
     * Soft-delete trong DB trước.
     *
     * Nếu DB update thất bại thì chưa đụng đến Cloudinary,
     * tránh trường hợp DB vẫn hiện media nhưng file thật đã mất.
     */
    try {
      await this.prisma.media.update({
        where: {
          id: mediaId,
        },

        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw new BadRequestException(`Lỗi khi xóa media: ${message}`);
    }

    /**
     * Sau khi DB đã soft-delete thành công,
     * cố gắng cleanup file thật trên Cloudinary.
     *
     * Nếu Cloudinary lỗi thì media vẫn giữ trạng thái đã xóa
     * trong hệ thống. File dư trên Cloudinary có thể cleanup sau,
     * nhưng không để media bị hiện lại cho người dùng.
     */
    if (media.publicId) {
      const resourceType =
        media.mediaType === MediaType.VIDEO ? 'video' : 'image';

      try {
        await this.cloudinary.deleteFile(media.publicId, resourceType);
      } catch {
        // Không rollback soft-delete nếu cleanup Cloudinary thất bại.
      }
    }

    return {
      message: 'Đã xóa media thành công',
    };
  }
}
