/// <reference types="multer" />

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
  CloudinaryService,
  MediaService,
  NotPostOwnerException,
  PaginatedResult,
  PaginationParams,
  PostsService,
  PrismaService,
} from '@app/core';

import {
  CreateBlogownerPostDto,
  GetBlogownerPostsDto,
  TranslateBlogownerPostDto,
  UpdateBlogownerPostDto,
} from '../dto';
import { BlogownerPostEntity } from '../entities';
import { BlogownerPostHelperService } from './blogowner-post-helper.service';

/**
 * Các quan hệ được lấy khi trả bài viết cho Blog Owner.
 *
 * Blog Owner được xem:
 * - tác giả;
 * - ngôn ngữ;
 * - danh mục;
 * - thẻ;
 * - trạng thái kiểm duyệt;
 * - lý do bị từ chối.
 */
const BLOGOWNER_POST_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
    },
  },

  language: true,

  postCategories: {
    include: {
      category: {
        include: {
          language: true,
          categoryGroup: true,
        },
      },
    },
  },

  postTags: {
    include: {
      tag: true,
    },
  },

  media: {
  where: {
    deletedAt: null,
  },
  select: {
    id: true,
    postId: true,
    mediaType: true,
    mediaUrl: true,
    publicId: true,
    createdAt: true,
    deletedAt: true,
  },
  orderBy: {
    createdAt: 'asc',
  },
},
} satisfies Prisma.PostInclude;

@Injectable()
export class BlogownerPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
    private readonly helper: BlogownerPostHelperService,
    private readonly mediaService: MediaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Xem toàn bộ bài viết của Blog Owner đang đăng nhập.
   */
  async findAll(
    ownerId: number,
    query: GetBlogownerPostsDto,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BlogownerPostEntity>> {
    const result = await this.postsService.findAll(
      {
        ...query,
        authorId: ownerId,
      },
      pagination,
      BLOGOWNER_POST_INCLUDE,
      {
        updatedAt: 'desc',
      },
    );

    return {
      ...result,
      items: result.items.map((post) => new BlogownerPostEntity(post)),
    };
  }

  /**
   * Xem chi tiết một bài viết của chính Blog Owner.
   *
   * Cho phép xem cả:
   * - DRAFT;
   * - PENDING_REVIEW;
   * - PUBLISH;
   * - REJECT;
   * - rejectionReason.
   */
async findOne(
  ownerId: number,
  postId: number,
): Promise<BlogownerPostEntity> {
  const post = await this.helper.findOwnedPost(
    ownerId,
    postId,
    BLOGOWNER_POST_INCLUDE,
  );

  /**
   * Nếu post đang xem là bài gốc:
   * rootPostId = chính id của nó.
   *
   * Nếu post đang xem là bản dịch:
   * rootPostId = parentPostId.
   */
  const rootPostId = post.parentPostId ?? post.id;

  /**
   * Lấy toàn bộ phiên bản ngôn ngữ trong cùng nhóm.
   */
  const translations = await this.prisma.post.findMany({
    where: {
      authorId: ownerId,
      deletedAt: null,

      OR: [
        {
          id: rootPostId,
        },
        {
          parentPostId: rootPostId,
        },
      ],
    },

    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      status: true,
      parentPostId: true,
      languageId: true,

      language: {
        select: {
          id: true,
          code: true,
          name: true,
          flag: true,
        },
      },
    },

    orderBy: [
      {
        language: {
          code: 'asc',
        },
      },
      {
        id: 'asc',
      },
    ],
  });

  return new BlogownerPostEntity({
    ...post,
    translations,
  });
}

  /**
   * Tạo bài viết mới.
   *
   * Blog Owner không được tự chọn trạng thái.
   * Mọi bài mới luôn được tạo dưới dạng DRAFT.
   */
  async create(
    ownerId: number,
    dto: CreateBlogownerPostDto,
    thumbnailFile?: Express.Multer.File,
    mediaFiles?: Express.Multer.File[],
  ): Promise<BlogownerPostEntity> {
    const createdPost = await this.postsService.create(ownerId, {
      ...dto,
      status: PostStatus.DRAFT,
    });

    if (thumbnailFile) {
      if (!thumbnailFile.mimetype.startsWith('image/')) {
        throw new BadRequestException('Chỉ hỗ trợ tải lên file ảnh cho thumbnail');
      }
      try {
        const uploadedResult = await this.cloudinary.uploadFile(
          thumbnailFile,
          `nestjs_blog/posts/${createdPost.id}/thumbnail`,
        );
        await this.prisma.post.update({
          where: { id: createdPost.id },
          data: {
            thumbnailUrl: uploadedResult.secure_url,
          },
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Lỗi không xác định';
        throw new BadRequestException(
          `Lỗi khi upload thumbnail: ${message}`,
        );
      }
    }

    if (mediaFiles && mediaFiles.length > 0) {
      for (const file of mediaFiles) {
        await this.mediaService.uploadMedia(createdPost.id, file);
      }
    }

    return this.findOne(ownerId, createdPost.id);
  }

  /**
   * Chỉnh sửa bài viết của chính Blog Owner.
   *
   * Quy tắc:
   * - DRAFT          -> vẫn DRAFT
   * - REJECT         -> DRAFT
   * - PUBLISH        -> PENDING_REVIEW
   * - PENDING_REVIEW -> không được sửa
   */
  async update(
    ownerId: number,
    postId: number,
    dto: UpdateBlogownerPostDto,
    thumbnailFile?: Express.Multer.File,
    mediaFiles?: Express.Multer.File[],
  ): Promise<BlogownerPostEntity> {
    const existingPost = await this.helper.findOwnedPost(
      ownerId,
      postId,
      BLOGOWNER_POST_INCLUDE,
    );

    this.helper.assertEditable(existingPost.status);

    const nextStatus = this.helper.getNextStatusOnEdit(existingPost.status);

 const updateData = { ...dto };

let newThumbnailPublicId: string | null = null;

if (thumbnailFile) {
  if (!thumbnailFile.mimetype.startsWith('image/')) {
    throw new BadRequestException(
      'Chỉ hỗ trợ tải lên file ảnh cho thumbnail',
    );
  }

  try {
    /**
     * Upload ảnh mới trước.
     *
     * Chưa xóa thumbnail cũ ở đây để tránh trường hợp
     * upload/update DB lỗi làm mất ảnh cũ.
     */
    const uploadedResult = await this.cloudinary.uploadFile(
      thumbnailFile,
      `nestjs_blog/posts/${postId}/thumbnail`,
    );

    updateData.thumbnailUrl = uploadedResult.secure_url;
    newThumbnailPublicId = uploadedResult.public_id;
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Lỗi không xác định';

    throw new BadRequestException(
      `Lỗi khi upload thumbnail: ${message}`,
    );
  }
}

try {
  await this.postsService.update(postId, {
    ...updateData,
    status: nextStatus,
  });
} catch (error) {
  /**
   * Ảnh mới đã upload nhưng DB update thất bại.
   * Cleanup ảnh mới để tránh file rác trên Cloudinary.
   */
  if (newThumbnailPublicId) {
    try {
      await this.cloudinary.deleteFile(
        newThumbnailPublicId,
        'image',
      );
    } catch {
      // Không ghi đè lỗi update DB ban đầu.
    }
  }

  throw error;
}

/**
 * Chỉ xóa thumbnail cũ sau khi DB đã cập nhật
 * thành công sang thumbnail mới.
 */
if (thumbnailFile) {
  await this.deleteOldThumbnail(
    existingPost.thumbnailUrl,
  );
}

    if (mediaFiles && mediaFiles.length > 0) {
      for (const file of mediaFiles) {
        await this.mediaService.uploadMedia(postId, file);
      }
    }

    /*
     * Khi bài bị từ chối được sửa lại hoặc bài đã xuất bản
     * được cập nhật, xóa thông tin kiểm duyệt cũ.
     *
     * publishedAt không bị thay đổi.
     */
    await this.helper.resetReviewOnEdit(postId, existingPost.status);

    return this.findOne(ownerId, postId);
  }

  private async deleteOldThumbnail(thumbnailUrl: string | null) {
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

  /**
   * Xóa mềm bài viết.
   *
   * Bản ghi vẫn còn trong database nhưng deletedAt được gán ngày giờ.
   */
  async remove(
    ownerId: number,
    postId: number,
  ): Promise<{
    message: string;
  }> {
    await this.helper.findOwnedPost(ownerId, postId);

    await this.postsService.remove(postId);

    return {
      message: `Đã xóa bài viết có ID ${postId}.`,
    };
  }

/**
 * Gửi bài sang Moderator để kiểm duyệt.
 *
 * Chỉ cho phép:
 * - DRAFT -> PENDING_REVIEW
 *
 * Bài REJECT phải được chỉnh sửa trước.
 * Khi chỉnh sửa, update() sẽ chuyển REJECT -> DRAFT.
 */
  async submitForReview(
    ownerId: number,
    postId: number,
  ): Promise<BlogownerPostEntity> {
    const post = await this.helper.findOwnedPost(ownerId, postId);

    if (post.status === PostStatus.PENDING_REVIEW) {
  throw new BadRequestException(
    'Bài viết này đang chờ Moderator duyệt.',
  );
}

if (post.status === PostStatus.PUBLISH) {
  throw new BadRequestException(
    'Bài viết đã được xuất bản. Chỉ khi chỉnh sửa bài thì bài mới được gửi duyệt lại.',
  );
}

if (post.status === PostStatus.REJECT) {
  throw new BadRequestException(
    'Bài viết bị từ chối phải được chỉnh sửa trước khi gửi duyệt lại.',
  );
}

if (post.status !== PostStatus.DRAFT) {
  throw new BadRequestException(
    `Không thể gửi duyệt bài viết đang ở trạng thái ${post.status}.`,
  );
}

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

    return this.findOne(ownerId, postId);
  }

  /**
   * Tạo bản dịch từ bài viết nguồn.
   *
   * Quy tắc:
   * - bài nguồn phải thuộc Blog Owner;
   * - mỗi ngôn ngữ chỉ có một bản trong cùng nhóm dịch;
   * - category được tìm theo CategoryGroup;
   * - tag được sao chép từ bài nguồn;
   * - bài dịch mới luôn là DRAFT.
   */
  async translate(
    ownerId: number,
    sourcePostId: number,
    dto: TranslateBlogownerPostDto,
  ): Promise<BlogownerPostEntity> {
    /*
     * Cần truy cập trực tiếp Prisma relations:
     * - postCategories → category.categoryGroupId
     * - postTags → tagId
     *
     * Nên query riêng thay vì dùng BlogownerPostEntity.
     */
    const sourcePost = await this.prisma.post.findFirst({
      where: {
        id: sourcePostId,
        deletedAt: null,
      },
      include: {
        postCategories: {
          include: {
            category: true,
          },
        },
        postTags: true,
      },
    });

    if (!sourcePost) {
      throw new BadRequestException(
        `Không tìm thấy bài viết nguồn có ID ${sourcePostId}.`,
      );
    }

    if (sourcePost.authorId !== ownerId) {
      throw new NotPostOwnerException();
    }

    const targetLanguage = await this.prisma.language.findFirst({
      where: {
        id: dto.targetLanguageId,
        deletedAt: null,
      },
    });

    if (!targetLanguage) {
      throw new BadRequestException(
        `Không tìm thấy ngôn ngữ đích có ID ${dto.targetLanguageId}.`,
      );
    }

    /*
     * Tất cả bản dịch đều trỏ về bài gốc.
     *
     * Nếu sourcePost đã là bản dịch:
     * dùng parentPostId của nó.
     *
     * Nếu sourcePost là bài gốc:
     * dùng chính sourcePost.id.
     */
    const rootPostId = sourcePost.parentPostId ?? sourcePost.id;

    /*
     * Kiểm tra trong cả nhóm bài gốc và các bản dịch
     * đã có ngôn ngữ đích chưa.
     */
    const existingTranslation = await this.prisma.post.findFirst({
      where: {
        languageId: dto.targetLanguageId,

        OR: [
          {
            id: rootPostId,
          },
          {
            parentPostId: rootPostId,
          },
        ],
      },
    });

    if (existingTranslation && existingTranslation.deletedAt === null) {
  throw new ConflictException(
    'Bài viết đã có phiên bản cho ngôn ngữ được chọn.',
  );
}

    const categoryGroupIds = Array.from(
      new Set(
        sourcePost.postCategories.map(
          (postCategory) => postCategory.category.categoryGroupId,
        ),
      ),
    );

    if (categoryGroupIds.length === 0) {
      throw new BadRequestException('Bài viết nguồn chưa có danh mục.');
    }

    /*
     * Không dịch tên category tại đây.
     *
     * Backend tìm category đã tồn tại trong cùng CategoryGroup
     * và đúng ngôn ngữ đích.
     */
    const translatedCategories = await this.prisma.category.findMany({
      where: {
        categoryGroupId: {
          in: categoryGroupIds,
        },
        languageId: dto.targetLanguageId,
        deletedAt: null,
        categoryGroup: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        categoryGroupId: true,
      },
    });

    if (translatedCategories.length !== categoryGroupIds.length) {
      throw new BadRequestException(
        'Một hoặc nhiều danh mục chưa có bản dịch trong ngôn ngữ được chọn.',
      );
    }

    const sourceTagIds = sourcePost.postTags.map((postTag) => postTag.tagId);
    /**
 * Nếu phiên bản ngôn ngữ này từng bị soft-delete,
 * sử dụng lại record cũ thay vì tạo record mới.
 *
 * Điều này cũng tránh vi phạm unique:
 * (parentPostId, languageId).
 */
if (existingTranslation) {
  await this.prisma.post.update({
    where: {
      id: existingTranslation.id,
    },

    data: {
      title: dto.title,
      content: dto.content,

      thumbnailUrl:
        dto.thumbnailUrl ?? sourcePost.thumbnailUrl ?? null,

      status: PostStatus.DRAFT,

      parentPostId: rootPostId,
      languageId: dto.targetLanguageId,

      deletedAt: null,

      publishedAt: null,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,

      postCategories: {
        deleteMany: {},

        create: translatedCategories.map((category) => ({
          categoryId: category.id,
        })),
      },

      postTags: {
        deleteMany: {},

        create: sourceTagIds.map((tagId) => ({
          tagId,
        })),
      },
    },
  });

  return this.findOne(ownerId, existingTranslation.id);
}

    const translatedPost = await this.postsService.create(ownerId, {
      title: dto.title,
      content: dto.content,

      thumbnailUrl: dto.thumbnailUrl ?? sourcePost.thumbnailUrl ?? undefined,

      languageId: dto.targetLanguageId,

      categoryIds: translatedCategories.map((category) => category.id),

      tagIds: sourceTagIds,

      parentPostId: rootPostId,
      status: PostStatus.DRAFT,
    });

    return this.findOne(ownerId, translatedPost.id);
  }
}

