/// <reference types="multer" />

import { Injectable, NotFoundException } from '@nestjs/common';

import { MediaService, PrismaService } from '@app/core';

import { BlogownerPostHelperService } from './blogowner-post-helper.service';

@Injectable()
export class BlogownerMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly helper: BlogownerPostHelperService,
  ) {}

  /**
   * Upload media cho bài viết của Blog Owner.
   */
  async upload(
    ownerId: number,
    postId: number,
    file: Express.Multer.File,
  ) {
    const post = await this.helper.findOwnedPost(ownerId, postId);

    this.helper.assertEditable(post.status);

    const media = await this.mediaService.uploadMedia(postId, file);

    await this.helper.resetReviewOnEdit(postId, post.status);

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
    const post = await this.helper.findOwnedPost(ownerId, postId);

    this.helper.assertEditable(post.status);

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

    await this.helper.resetReviewOnEdit(postId, post.status);

    return result;
  }
}