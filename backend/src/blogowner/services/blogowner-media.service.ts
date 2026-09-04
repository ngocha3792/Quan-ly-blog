/// <reference types="multer" />

import { Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';

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
   *
   * Với bài PUBLISH:
   * - chuyển bài về PENDING_REVIEW trước khi thay đổi media;
   * - tránh trường hợp media đã thay đổi nhưng bài vẫn PUBLISH
   *   nếu việc reset trạng thái thất bại.
   *
   * Với bài REJECT:
   * - chỉ chuyển về DRAFT sau khi upload thành công;
   * - tránh thoát REJECT nếu upload thất bại.
   */
  async upload(ownerId: number, postId: number, file: Express.Multer.File) {
    const post = await this.helper.findOwnedPost(ownerId, postId);

    this.helper.assertEditable(post.status);

    const isPublished = post.status === PostStatus.PUBLISH;

    /**
     * Bài đang public phải rời trạng thái PUBLISH
     * trước khi media thực tế bị thay đổi.
     */
    if (isPublished) {
      await this.helper.resetReviewOnEdit(postId, post.status);
    }

    const media = await this.mediaService.uploadMedia(postId, file);

    /**
     * REJECT chỉ được chuyển về DRAFT
     * sau khi edit media thật sự thành công.
     *
     * DRAFT gọi helper cũng an toàn vì helper
     * không thay đổi gì với DRAFT.
     */
    if (!isPublished) {
      await this.helper.resetReviewOnEdit(postId, post.status);
    }

    return media;
  }

  /**
   * Xóa media khỏi bài viết của Blog Owner.
   *
   * Quy tắc trạng thái giống upload:
   * - PUBLISH: chuyển PENDING_REVIEW trước khi xóa;
   * - REJECT: chỉ chuyển DRAFT sau khi xóa thành công;
   * - DRAFT: giữ nguyên.
   */
  async remove(ownerId: number, postId: number, mediaId: number) {
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
      throw new NotFoundException('Media không tồn tại trong bài viết này');
    }

    const isPublished = post.status === PostStatus.PUBLISH;

    /**
     * Với bài đã public, rút bài khỏi trạng thái
     * PUBLISH trước khi media bị xóa.
     */
    if (isPublished) {
      await this.helper.resetReviewOnEdit(postId, post.status);
    }

    const result = await this.mediaService.deleteMedia(mediaId);

    /**
     * REJECT chỉ thoát REJECT khi thao tác xóa
     * media thực sự thành công.
     */
    if (!isPublished) {
      await this.helper.resetReviewOnEdit(postId, post.status);
    }

    return result;
  }
}
