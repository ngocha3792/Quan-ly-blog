/// <reference types="multer" />

import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'node:path';
import { PostStatus, Prisma } from '@prisma/client';

import {
  CloudinaryService,
  MediaService,
  NotPostOwnerException,
  PostNotFoundException,
  PrismaService,
} from '@app/core';


const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024;

const THUMBNAIL_TYPES = {
  jpeg: {
    mimeTypes: ['image/jpeg'],
    extensions: ['.jpg', '.jpeg'],
  },
  png: {
    mimeTypes: ['image/png'],
    extensions: ['.png'],
  },
  webp: {
    mimeTypes: ['image/webp'],
    extensions: ['.webp'],
  },
} as const;

type ThumbnailType = keyof typeof THUMBNAIL_TYPES;

/**
 * Nhận diện định dạng ảnh từ magic bytes thật trong buffer.
 * Không tin MIME/extension do client gửi lên.
 */
function detectThumbnailType(buffer: Buffer): ThumbnailType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }

  const pngSignature = [
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ];

  if (
    buffer.length >= pngSignature.length &&
    pngSignature.every((byte, index) => buffer[index] === byte)
  ) {
    return 'png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

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
  async findOwnedPostGroup(ownerId: number, postId: number) {
    const rootPostId = await this.resolveOwnedRootPostId(ownerId, postId);

    const posts = await this.prisma.post.findMany({
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
      (post) => post.id === rootPostId && post.parentPostId === null,
    );

    if (!root) {
      throw new PostNotFoundException(rootPostId.toString());
    }

    const translations = posts.filter(
      (post) => post.parentPostId === rootPostId,
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
    const { rootPostId } = await this.findOwnedPostGroup(ownerId, postId);

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
   * Validate ảnh trước khi upload lên Cloudinary.
   *
   * Security rule:
   * - chỉ JPEG / PNG / WEBP;
   * - tối đa 10 MB;
   * - kiểm tra magic bytes thật trong buffer;
   * - MIME và extension phải khớp với định dạng đã nhận diện.
   *
   * Nhờ đó file HTML/SVG/JS/PDF đổi tên thành .png hoặc giả MIME
   * vẫn bị từ chối trước khi gửi lên Cloudinary.
   *
   * `label` chỉ dùng để message lỗi đúng ngữ cảnh (ảnh bìa / ảnh nội
   * dung) — logic kiểm tra giống hệt nhau cho mọi loại ảnh.
   */
  private validateImageFile(
    file: Express.Multer.File,
    label: string,
  ): void {
    /**
     * label viết hoa chữ cái đầu — dùng cho message bắt đầu câu bằng
     * chính label (khác với các message có label nằm giữa câu).
     */
    const Label = label.charAt(0).toUpperCase() + label.slice(1);

    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(`File ${label} không hợp lệ hoặc bị rỗng.`);
    }

    if (
      file.size > MAX_THUMBNAIL_SIZE ||
      file.buffer.length > MAX_THUMBNAIL_SIZE
    ) {
      throw new BadRequestException(`${Label} không được vượt quá 10 MB.`);
    }

    const detectedType = detectThumbnailType(file.buffer);

    if (!detectedType) {
      throw new BadRequestException(
        `${Label} chỉ hỗ trợ file JPEG, PNG hoặc WEBP hợp lệ.`,
      );
    }

    const allowedType = THUMBNAIL_TYPES[detectedType];
    const extension = extname(file.originalname ?? '').toLowerCase();

    if (!allowedType.mimeTypes.some((mimeType) => mimeType === file.mimetype)) {
      throw new BadRequestException(
        `MIME type của ${label} không khớp với nội dung file thực tế.`,
      );
    }

    if (
      !allowedType.extensions.some(
        (allowedExtension) => allowedExtension === extension,
      )
    ) {
      throw new BadRequestException(
        `Phần mở rộng ${label} không khớp với định dạng file thực tế.`,
      );
    }
  }

  /** Validate ảnh bìa trước khi tạo/update Post. */
  validateThumbnailFile(file: Express.Multer.File): void {
    this.validateImageFile(file, 'ảnh bìa');
  }

  /** Validate ảnh chèn vào nội dung bài viết (Quill editor). */
  validateContentImageFile(file: Express.Multer.File): void {
    this.validateImageFile(file, 'ảnh nội dung');
  }

  /** Upload thumbnail đã được validate lên Cloudinary. */
  async uploadThumbnail(postId: number, file: Express.Multer.File) {
    this.validateThumbnailFile(file);

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
        const uploadedMedia = await this.mediaService.uploadMedia(postId, file);

        uploadedMediaIds.push(uploadedMedia.id);
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
      for (let index = uploadedMediaIds.length - 1; index >= 0; index -= 1) {
        try {
          await this.mediaService.deleteMedia(uploadedMediaIds[index]);
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
