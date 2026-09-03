/// <reference types="multer" />

import { BadRequestException, Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
  CloudinaryService,
  MediaService,
  NotPostOwnerException,
  PostNotFoundException,
  PrismaService,
} from '@app/core';

export const RESET_REVIEW_DATA = {
  reviewedById: null,
  reviewedAt: null,
  rejectionReason: null,
} as const;

/**
 * Logic dùng chung giữa các service trong module Blog Owner (Posts, Media, v.v.).
 *
 * Gồm:
 * - kiểm tra quyền sở hữu bài viết;
 * - kiểm tra bài có cho phép chỉnh sửa / gửi duyệt không;
 * - xử lý chuyển trạng thái và reset thông tin kiểm duyệt khi bài bị sửa;
 * - xử lý upload thumbnail và media đính kèm.
 */
@Injectable()
export class BlogownerPostHelperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

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
 * Từ bất kỳ postId nào của Blog Owner, xác định ID bài gốc.
 *
 * - Nếu postId là bài gốc: rootPostId = post.id.
 * - Nếu postId là bản dịch: rootPostId = post.parentPostId.
 */
async resolveOwnedRootPostId(
  ownerId: number,
  postId: number,
): Promise<number> {
  const post = await this.findOwnedPost(ownerId, postId);

  return post.parentPostId ?? post.id;
}

/**
 * Lấy toàn bộ nhóm bài viết của Blog Owner.
 *
 * Một group gồm:
 * - root: bài gốc;
 * - translations: toàn bộ bản dịch active;
 * - posts: root + translations.
 */
async findOwnedPostGroup(
  ownerId: number,
  postId: number,
) {
  const rootPostId =
    await this.resolveOwnedRootPostId(
      ownerId,
      postId,
    );

  const posts =
    await this.prisma.post.findMany({
      where: {
        authorId: ownerId,
        deletedAt: null,

        OR: [
          {
            id: rootPostId,
            parentPostId: null,
          },
          {
            parentPostId: rootPostId,
          },
        ],
      },

      orderBy: {
        id: 'asc',
      },
    });

  const root = posts.find(
    (post) =>
      post.id === rootPostId &&
      post.parentPostId === null,
  );

  if (!root) {
    throw new PostNotFoundException(
      rootPostId.toString(),
    );
  }

  const translations = posts.filter(
    (post) =>
      post.parentPostId === rootPostId,
  );

  return {
    rootPostId,
    root,
    translations,
    posts,
  };
}

/**
 * Đổi trạng thái toàn bộ group:
 *
 * root + tất cả translations active.
 */
async updateOwnedPostGroupStatus(
  ownerId: number,
  postId: number,
  status: PostStatus,
): Promise<void> {
  const { rootPostId } =
    await this.findOwnedPostGroup(
      ownerId,
      postId,
    );

  await this.prisma.post.updateMany({
    where: {
      authorId: ownerId,
      deletedAt: null,

      OR: [
        {
          id: rootPostId,
          parentPostId: null,
        },
        {
          parentPostId: rootPostId,
        },
      ],
    },

    data: {
      status,
      ...RESET_REVIEW_DATA,
    },
  });
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
   * Kiểm tra bài viết có ở trạng thái cho phép gửi duyệt không (phải là DRAFT).
   */
  assertSubmittable(status: PostStatus): void {
    if (status !== PostStatus.DRAFT) {
      const statusErrors: Record<string, string> = {
        [PostStatus.PENDING_REVIEW]: 'Bài viết này đang chờ Moderator duyệt.',
        [PostStatus.PUBLISH]:
          'Bài viết đã được xuất bản. Chỉ khi chỉnh sửa bài thì bài mới được gửi duyệt lại.',
        [PostStatus.REJECT]:
          'Bài viết bị từ chối phải được chỉnh sửa trước khi gửi duyệt lại.',
      };

      throw new BadRequestException(
        statusErrors[status] ??
          `Không thể gửi duyệt bài viết đang ở trạng thái ${status}.`,
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
        ...RESET_REVIEW_DATA,
      },
    });
  }

  /**
   * Upload thumbnail cho bài viết lên Cloudinary.
   */
  async uploadThumbnail(postId: number, file: Express.Multer.File) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        'Chỉ hỗ trợ tải lên file ảnh cho thumbnail',
      );
    }

    try {
      return await this.cloudinary.uploadFile(
        file,
        `nestjs_blog/posts/${postId}/thumbnail`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw new BadRequestException(`Lỗi khi upload thumbnail: ${message}`);
    }
  }

  /**
   * Upload danh sách media files đi kèm bài viết.
   */
  async uploadMediaFiles(
  postId: number,
  files?: Express.Multer.File[],
): Promise<void> {
  if (!files || files.length === 0) {
    return;
  }

  /**
   * Lưu ID của những media đã upload thành công.
   *
   * Nếu một file phía sau thất bại, các media đã upload
   * trước đó sẽ được rollback để tránh dữ liệu dở dang.
   */
  const uploadedMediaIds: number[] = [];

  try {
    for (const file of files) {
      const uploadedMedia =
        await this.mediaService.uploadMedia(
          postId,
          file,
        );

      uploadedMediaIds.push(
        uploadedMedia.id,
      );
    }
  } catch (error: unknown) {
    /**
     * Rollback theo thứ tự ngược lại:
     *
     * media 1 ✅
     * media 2 ✅
     * media 3 ❌
     *
     * rollback:
     * media 2 → media 1
     */
    for (
      let index = uploadedMediaIds.length - 1;
      index >= 0;
      index -= 1
    ) {
      try {
        await this.mediaService.deleteMedia(
          uploadedMediaIds[index],
        );
      } catch {
        /**
         * Không ghi đè lỗi upload ban đầu.
         *
         * Nếu cleanup một media thất bại, vẫn tiếp tục
         * cleanup các media còn lại.
         */
      }
    }

    throw error;
  }
}

  /**
   * Xóa thumbnail cũ trên Cloudinary sau khi cập nhật thumbnail mới.
   */
  async deleteOldThumbnail(thumbnailUrl: string | null): Promise<void> {
    if (!thumbnailUrl || !thumbnailUrl.includes('/upload/')) return;
    try {
      const parts = thumbnailUrl.split('/upload/');
      if (parts.length > 1) {
        let path = parts[1];
        path = path.replace(/^v\d+\//, '');
        const publicId = path.substring(0, path.lastIndexOf('.')) || path;
        await this.cloudinary.deleteFile(publicId, 'image');
      }
    } catch {
      // Bỏ qua lỗi khi xóa ảnh cũ
    }
  }
}

