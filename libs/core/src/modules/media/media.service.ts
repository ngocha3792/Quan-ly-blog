import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MediaType } from '@prisma/client';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Upload một file và lưu vào database cho bài viết cụ thể
   */
  async uploadMedia(postId: number, file: Express.Multer.File, mediaType: MediaType) {
    // 1. Kiểm tra xem Post có tồn tại không
    const postExists = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!postExists) {
      throw new NotFoundException('Post không tồn tại');
    }

    try {
      // 2. Upload file lên Cloudinary
      const uploadedResult = await this.cloudinary.uploadFile(file);

      // 3. Lưu thông tin trả về vào Database
      const newMedia = await this.prisma.media.create({
        data: {
          postId,
          mediaType,
          mediaUrl: uploadedResult.secure_url,
          publicId: uploadedResult.public_id,
        },
      });

      return newMedia;
    } catch (error) {
      throw new BadRequestException('Lỗi khi upload file: ' + error.message);
    }
  }

  /**
   * Xóa một file khỏi Cloudinary và xóa record khỏi Database
   */
  async deleteMedia(mediaId: number) {
    const media = await this.prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException('Media không tồn tại');
    }

    try {
      // 1. Xóa file trên Cloudinary bằng publicId
      if (media.publicId) {
        await this.cloudinary.deleteFile(media.publicId);
      }

      // 2. Xóa record trong DB
      await this.prisma.media.delete({ where: { id: mediaId } });

      return { success: true, message: 'Đã xóa file thành công' };
    } catch (error) {
      throw new BadRequestException('Lỗi khi xóa file: ' + error.message);
    }
  }
}
