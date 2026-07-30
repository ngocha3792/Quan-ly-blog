/// <reference types="multer" />

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
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
import {
  BlogownerPostHelperService,
  RESET_REVIEW_DATA,
} from './blogowner-post-helper.service';

const LANGUAGE_SELECT = {
  id: true,
  code: true,
  name: true,
  flag: true,
} as const;

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
  ) { }

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
          select: LANGUAGE_SELECT,
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
      const uploadedResult = await this.helper.uploadThumbnail(
        createdPost.id,
        thumbnailFile,
      );
      await this.prisma.post.update({
        where: { id: createdPost.id },
        data: {
          thumbnailUrl: uploadedResult.secure_url,
        },
      });
    }

    await this.helper.uploadMediaFiles(createdPost.id, mediaFiles);

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
      const uploadedResult = await this.helper.uploadThumbnail(
        postId,
        thumbnailFile,
      );
      updateData.thumbnailUrl = uploadedResult.secure_url;
      newThumbnailPublicId = uploadedResult.public_id;
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
          await this.helper.deleteOldThumbnail(
            updateData.thumbnailUrl ?? null,
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
      await this.helper.deleteOldThumbnail(existingPost.thumbnailUrl);
    }

    await this.helper.uploadMediaFiles(postId, mediaFiles);

    /*
     * Khi bài bị từ chối được sửa lại hoặc bài đã xuất bản
     * được cập nhật, xóa thông tin kiểm duyệt cũ.
     *
     * publishedAt không bị thay đổi.
     */
    await this.helper.resetReviewOnEdit(postId, existingPost.status);

    return this.findOne(ownerId, postId);
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

    this.helper.assertSubmittable(post.status);

    await this.prisma.post.update({
      where: {
        id: postId,
      },
      data: {
        status: PostStatus.PENDING_REVIEW,
        ...RESET_REVIEW_DATA,
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

          thumbnailUrl: dto.thumbnailUrl ?? sourcePost.thumbnailUrl ?? null,

          status: PostStatus.DRAFT,

          parentPostId: rootPostId,
          languageId: dto.targetLanguageId,

          deletedAt: null,

          publishedAt: null,
          ...RESET_REVIEW_DATA,

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



