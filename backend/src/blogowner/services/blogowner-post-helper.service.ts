import { BadRequestException, Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
  NotPostOwnerException,
  PostNotFoundException,
  PrismaService,
} from '@app/core';

/**
 * Logic dùng chung giữa BlogownerPostsService và BlogownerMediaService.
 *
 * Gồm:
 * - kiểm tra quyền sở hữu bài viết;
 * - kiểm tra bài có cho phép chỉnh sửa không;
 * - xử lý chuyển trạng thái khi bài bị sửa.
 */
@Injectable()
export class BlogownerPostHelperService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tìm bài viết chưa bị xóa và kiểm tra quyền sở hữu.
   *
   * Không cho Blog Owner sửa/xóa bài của người khác.
   */
  async findOwnedPost<T extends Prisma.PostInclude | undefined = undefined>(
    ownerId: number,
    postId: number,
    include?: T,
  ) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
      ...(include ? { include } : {}),
    });

    if (!post) {
      throw new PostNotFoundException(postId.toString());
    }

    if (post.authorId !== ownerId) {
      throw new NotPostOwnerException();
    }

    return post;
  }

  /**
   * Kiểm tra bài có đang ở trạng thái cho phép chỉnh sửa không.
   *
   * Bài đang PENDING_REVIEW thì không được sửa nội dung lẫn media.
   */
  assertEditable(status: PostStatus): void {
    if (status === PostStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Bài viết đang chờ Moderator duyệt nên không thể chỉnh sửa.',
      );
    }
  }

  /**
   * Tính trạng thái tiếp theo khi bài bị sửa.
   *
   * - REJECT  → DRAFT
   * - PUBLISH → PENDING_REVIEW
   * - Các trạng thái khác giữ nguyên
   */
  getNextStatusOnEdit(currentStatus: PostStatus): PostStatus {
    if (currentStatus === PostStatus.REJECT) {
      return PostStatus.DRAFT;
    }

    if (currentStatus === PostStatus.PUBLISH) {
      return PostStatus.PENDING_REVIEW;
    }

    return currentStatus;
  }

  /**
   * Reset thông tin kiểm duyệt và cập nhật trạng thái khi bài bị sửa.
   *
   * Chỉ thực hiện khi bài đang ở REJECT hoặc PUBLISH.
   * Kết hợp cập nhật status và xóa review info trong một query.
   */
  async resetReviewOnEdit(
    postId: number,
    currentStatus: PostStatus,
  ): Promise<void> {
    if (
      currentStatus !== PostStatus.REJECT &&
      currentStatus !== PostStatus.PUBLISH
    ) {
      return;
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: this.getNextStatusOnEdit(currentStatus),
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    });
  }
}
