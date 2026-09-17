/// <reference types="multer" />

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
   * Upload media cho POST GROUP của Blog Owner.
   *
   * Quy tắc:
   * - API chỉ nhận ID của ROOT post;
   * - không cho thao tác media riêng trên translation;
   * - nếu bất kỳ version nào đang PENDING_REVIEW thì khóa cả group;
   * - media luôn được gắn vào ROOT;
   * - nếu group đang PUBLISH thì đưa cả group về PENDING_REVIEW
   *   trước khi thay đổi media;
   * - nếu group đang REJECT thì chỉ đưa cả group về DRAFT
   *   sau khi upload thành công;
   * - DRAFT giữ nguyên DRAFT.
   *
   * Cách làm này giữ trạng thái của root + translations đồng bộ
   * và tránh trường hợp chỉ một translation đổi trạng thái.
   */
  async upload(
    ownerId: number,
    postId: number,
    file: Express.Multer.File,
  ) {
    const { root, posts } =
      await this.helper.findOwnedPostGroup(
        ownerId,
        postId,
      );

    /**
     * Media của một bài đa ngôn ngữ được quản lý từ ROOT.
     * Không cho gọi standalone media API bằng translationId.
     */
    if (postId !== root.id) {
      throw new BadRequestException(
        'Chỉ được thay đổi media của bài gốc. Các bản dịch thuộc cùng một nhóm bài viết.',
      );
    }

    /**
     * Nếu bất kỳ version nào đang chờ Moderator duyệt
     * thì khóa toàn bộ group.
     */
    for (const groupPost of posts) {
      this.helper.assertEditable(
        groupPost.status,
      );
    }

    const hasPublishedPost =
      posts.some(
        (groupPost) =>
          groupPost.status ===
          PostStatus.PUBLISH,
      );

    const hasRejectedPost =
      posts.some(
        (groupPost) =>
          groupPost.status ===
          PostStatus.REJECT,
      );

    /**
     * Nếu group đang public, phải rời trạng thái PUBLISH
     * trước khi media thực tế bị thay đổi.
     *
     * Nếu upload fail thì group vẫn PENDING_REVIEW.
     * Đây là lựa chọn an toàn hơn việc để nội dung public
     * trong khi thao tác media có thể đã thay đổi một phần.
     */
    if (hasPublishedPost) {
      await this.helper.updateOwnedPostGroupStatus(
        ownerId,
        root.id,
        PostStatus.PENDING_REVIEW,
      );
    }

    /**
     * Standalone media luôn thuộc ROOT post.
     */
    const media =
      await this.mediaService.uploadMedia(
        root.id,
        file,
      );

    /**
     * REJECT chỉ thoát REJECT sau khi upload thành công.
     *
     * Dữ liệu bình thường luôn có cùng status trong group.
     * Check `hasRejectedPost` giúp bảo vệ cả dữ liệu cũ bị lệch status.
     */
    if (
      !hasPublishedPost &&
      hasRejectedPost
    ) {
      await this.helper.updateOwnedPostGroupStatus(
        ownerId,
        root.id,
        PostStatus.DRAFT,
      );
    }

    return media;
  }

  /**
   * Xóa media khỏi POST GROUP của Blog Owner.
   *
   * Quy tắc giống upload:
   * - chỉ ROOT id;
   * - media phải thuộc ROOT;
   * - khóa nếu bất kỳ version nào PENDING_REVIEW;
   * - PUBLISH -> cả group PENDING_REVIEW trước khi xóa;
   * - REJECT -> cả group DRAFT sau khi xóa thành công;
   * - DRAFT giữ nguyên.
   */
  async remove(
    ownerId: number,
    postId: number,
    mediaId: number,
  ) {
    const { root, posts } =
      await this.helper.findOwnedPostGroup(
        ownerId,
        postId,
      );

    if (postId !== root.id) {
      throw new BadRequestException(
        'Chỉ được thay đổi media của bài gốc. Các bản dịch thuộc cùng một nhóm bài viết.',
      );
    }

    for (const groupPost of posts) {
      this.helper.assertEditable(
        groupPost.status,
      );
    }

    /**
     * Media standalone được quản lý ở ROOT.
     * Không cho xóa media của translation hoặc post khác.
     */
    const media =
      await this.prisma.media.findFirst({
        where: {
          id: mediaId,
          postId: root.id,
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

    const hasPublishedPost =
      posts.some(
        (groupPost) =>
          groupPost.status ===
          PostStatus.PUBLISH,
      );

    const hasRejectedPost =
      posts.some(
        (groupPost) =>
          groupPost.status ===
          PostStatus.REJECT,
      );

    if (hasPublishedPost) {
      await this.helper.updateOwnedPostGroupStatus(
        ownerId,
        root.id,
        PostStatus.PENDING_REVIEW,
      );
    }

    const result =
      await this.mediaService.deleteMedia(
        mediaId,
      );

    if (
      !hasPublishedPost &&
      hasRejectedPost
    ) {
      await this.helper.updateOwnedPostGroupStatus(
        ownerId,
        root.id,
        PostStatus.DRAFT,
      );
    }

    return result;
  }
}