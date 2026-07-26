/// <reference types="multer" />

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus } from '@prisma/client';

import {
  MediaService,
  NotPostOwnerException,
  PrismaService,
} from '@app/core';

@Injectable()
export class BlogownerMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Upload media cho bài viết của Blog Owner.
   */
  async upload(
    ownerId: number,
    postId: number,
    file: Express.Multer.File,
  ) {
    const post = await this.getOwnedPost(ownerId, postId);

    this.checkMediaEditable(post.status);

    const media = await this.mediaService.uploadMedia(postId, file);

    await this.updateStatusAfterMediaChange(postId, post.status);

    return media;
  }

  /**
   * Xóa media khỏi bài viết của Blog Owner.
   */
  async remove(
    ownerId: number,
    postId: number,
    mediaId: number,
  ) {
    const post = await this.getOwnedPost(ownerId, postId);

    this.checkMediaEditable(post.status);

    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        postId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!media) {
      throw new NotFoundException(
        'Media không tồn tại trong bài viết này',
      );
    }

    const result = await this.mediaService.deleteMedia(mediaId);

    await this.updateStatusAfterMediaChange(postId, post.status);

    return result;
  }

  /**
   * Lấy bài và kiểm tra quyền sở hữu.
   */
  private async getOwnedPost(ownerId: number, postId: number) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
      select: {
        id: true,
        authorId: true,
        status: true,
      },
    });

    if (!post) {
      throw new NotFoundException(
        'Bài viết không tồn tại hoặc đã bị xóa',
      );
    }

    if (post.authorId !== ownerId) {
      throw new NotPostOwnerException();
    }

    return post;
  }

  /**
   * Không cho sửa media khi Moderator đang duyệt bài.
   */
  private checkMediaEditable(status: PostStatus) {
    if (status === PostStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Bài viết đang chờ Moderator duyệt nên không thể thay đổi media',
      );
    }
  }

  /**
   * Đồng bộ trạng thái bài sau khi sửa media.
   */
  private async updateStatusAfterMediaChange(
    postId: number,
    currentStatus: PostStatus,
  ) {
    if (currentStatus === PostStatus.REJECT) {
      await this.prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          status: PostStatus.DRAFT,
          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });

      return;
    }

    if (currentStatus === PostStatus.PUBLISH) {
      await this.prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          status: PostStatus.PENDING_REVIEW,
          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
    }
  }
}