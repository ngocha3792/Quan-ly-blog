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
  AutoTranslateBlogownerPostDto,
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
import { TranslationService } from './translation.service';
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
    private readonly translationService : TranslationService,
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
   * Blog Owner không được tự gửi status trực tiếp.
   *
   * Quy tắc:
   * - submitForReview = false / undefined:
   *   tạo bài và giữ trạng thái DRAFT.
   *
   * - submitForReview = true:
   *   backend vẫn tạo DRAFT trước,
   *   hoàn tất thumbnail/media,
   *   sau đó mới chuyển sang PENDING_REVIEW.
   *
   * Làm như vậy để Moderator không nhìn thấy một bài
   * đang PENDING_REVIEW trong khi upload file còn chưa hoàn tất.
   */
  async create(
    ownerId: number,
    dto: CreateBlogownerPostDto,
    thumbnailFile?: Express.Multer.File,
    mediaFiles?: Express.Multer.File[],
  ): Promise<BlogownerPostEntity> {
    /**
     * submitForReview chỉ là business flag của Blog Owner,
     * không phải field của Post trong database.
     *
     * Vì vậy phải tách nó ra trước khi truyền DTO
     * xuống PostsService.
     */
    const {
      submitForReview = false,
      ...createPostData
    } = dto;

    /**
     * Bất kể Owner chọn lưu nháp hay gửi duyệt ngay,
     * Post luôn được tạo dưới dạng DRAFT trước.
     */
    const createdPost = await this.postsService.create(ownerId, {
      ...createPostData,
      status: PostStatus.DRAFT,
    });

    /**
     * Upload thumbnail trước.
     */
if (thumbnailFile) {
  const uploadedResult =
    await this.helper.uploadThumbnail(
      createdPost.id,
      thumbnailFile,
    );

  try {
    await this.prisma.post.update({
      where: {
        id: createdPost.id,
      },

      data: {
        thumbnailUrl:
          uploadedResult.secure_url,
      },
    });
  } catch (error: unknown) {
    /**
     * Thumbnail đã upload lên Cloudinary nhưng
     * database không lưu được URL.
     *
     * Xóa thumbnail vừa upload để tránh file rác.
     */
    try {
      await this.helper.deleteOldThumbnail(
        uploadedResult.secure_url,
      );
    } catch {
      /**
       * Không ghi đè lỗi database ban đầu
       * nếu cleanup Cloudinary thất bại.
       */
    }

    throw error;
  }
}

    /**
     * Upload toàn bộ media trước khi gửi Moderator duyệt.
     */
    await this.helper.uploadMediaFiles(
      createdPost.id,
      mediaFiles,
    );

    /**
     * Nếu Owner xác nhận bài đã hoàn chỉnh,
     * chuyển sang PENDING_REVIEW sau khi
     * toàn bộ quá trình tạo/upload đã hoàn tất.
     *
     * Blog Owner không được chuyển thẳng sang PUBLISH.
     */
    if (submitForReview) {
      await this.prisma.post.update({
        where: {
          id: createdPost.id,
        },
        data: {
          status: PostStatus.PENDING_REVIEW,
          ...RESET_REVIEW_DATA,
        },
      });
    }

    return this.findOne(
      ownerId,
      createdPost.id,
    );
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

/**
 * Chỉ xem request là một lần chỉnh sửa khi Owner
 * thực sự gửi ít nhất một trường dữ liệu hoặc file.
 *
 * Tránh trường hợp:
 * - REJECT + PATCH {}  -> DRAFT;
 * - PUBLISH + PATCH {} -> PENDING_REVIEW;
 * dù nội dung bài viết không hề được chỉnh sửa.
 */
const hasDtoChanges = Object.values(dto).some(
  (value) => value !== undefined,
);

const hasThumbnailChange = Boolean(thumbnailFile);

const hasMediaChanges = Boolean(
  mediaFiles && mediaFiles.length > 0,
);

if (
  !hasDtoChanges &&
  !hasThumbnailChange &&
  !hasMediaChanges
) {
  throw new BadRequestException(
    'Không có dữ liệu nào để cập nhật.',
  );
}

const nextStatus =
  this.helper.getNextStatusOnEdit(existingPost.status);

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
 * Sau khi nội dung bài viết đã được cập nhật thành công,
 * reset thông tin kiểm duyệt ngay lập tức.
 *
 * Việc này phải xảy ra trước các thao tác Cloudinary/media
 * phía sau để nếu upload media thất bại thì trạng thái bài
 * và review metadata vẫn nhất quán.
 *
 * - REJECT  -> DRAFT + clear review data
 * - PUBLISH -> PENDING_REVIEW + clear review data
 * - DRAFT   -> không thay đổi
 */
await this.helper.resetReviewOnEdit(
  postId,
  existingPost.status,
);

    /**
     * Chỉ xóa thumbnail cũ sau khi DB đã cập nhật
     * thành công sang thumbnail mới.
     */
    if (thumbnailFile) {
      await this.helper.deleteOldThumbnail(existingPost.thumbnailUrl);
    }

    await this.helper.uploadMediaFiles(postId, mediaFiles);

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
 * Dịch tự động title + content 
 *
 * API này chỉ trả preview:
 * - không tạo Post;
 * - không update Post;
 * - không thay đổi status.
 */
async translatePreview(
  ownerId: number,
  sourcePostId: number,
  dto: AutoTranslateBlogownerPostDto,
) {
  /**
   * Lấy bài nguồn cùng language và CategoryGroup.
   */
  const sourcePost =
    await this.prisma.post.findFirst({
      where: {
        id: sourcePostId,
        deletedAt: null,
      },

      select: {
        id: true,
        authorId: true,
        parentPostId: true,

        title: true,
        content: true,
        thumbnailUrl: true,

        language: {
          select: LANGUAGE_SELECT,
        },

        postCategories: {
          select: {
            category: {
              select: {
                categoryGroupId: true,
              },
            },
          },
        },
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

  /**
   * Ngôn ngữ đích phải đang hoạt động.
   */
  const targetLanguage =
    await this.prisma.language.findFirst({
      where: {
        id: dto.targetLanguageId,
        deletedAt: null,
        isActive: true,
      },

      select: LANGUAGE_SELECT,
    });

  if (!targetLanguage) {
    throw new BadRequestException(
      `Ngôn ngữ đích có ID ${dto.targetLanguageId} không tồn tại hoặc đang bị vô hiệu hóa.`,
    );
  }

  const rootPostId =
    sourcePost.parentPostId ??
    sourcePost.id;

  /**
   * Không gọi dịch vụ dịch tự động nếu bản dịch
   * cho ngôn ngữ này đã tồn tại.
   */
  const existingTranslation =
    await this.prisma.post.findFirst({
      where: {
        languageId:
          dto.targetLanguageId,

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
      },
    });

  if (existingTranslation) {
    throw new ConflictException(
      'Bài viết đã có phiên bản cho ngôn ngữ được chọn.',
    );
  }

  /**
   * Kiểm tra trước CategoryGroup có category
   * của language đích không.
   *
   * Nếu không có thì translate xong cũng
   * không thể lưu translation.
   */
  const categoryGroupIds = Array.from(
    new Set(
      sourcePost.postCategories.map(
        (postCategory) =>
          postCategory.category
            .categoryGroupId,
      ),
    ),
  );

  if (categoryGroupIds.length === 0) {
    throw new BadRequestException(
      'Bài viết nguồn chưa có danh mục.',
    );
  }

  const translatedCategories =
    await this.prisma.category.findMany({
      where: {
        categoryGroupId: {
          in: categoryGroupIds,
        },

        languageId:
          dto.targetLanguageId,

        deletedAt: null,

        categoryGroup: {
          deletedAt: null,
        },
      },

      select: {
        categoryGroupId: true,
      },
    });

  const translatedCategoryGroupIds =
    new Set(
      translatedCategories.map(
        (category) =>
          category.categoryGroupId,
      ),
    );

  if (
    translatedCategoryGroupIds.size !==
    categoryGroupIds.length
  ) {
    throw new BadRequestException(
      'Một hoặc nhiều danh mục chưa có bản dịch trong ngôn ngữ được chọn.',
    );
  }

 /**
 * Chỉ gọi dịch vụ dịch tự động sau khi
 * toàn bộ validation đã hoàn tất.
 */
  const translated = await this.translationService.translatePost({
      title: sourcePost.title,
      content: sourcePost.content,

      sourceLanguageCode:
        sourcePost.language.code,

      targetLanguageCode:
        targetLanguage.code,
    });

  /**
   * Chỉ trả preview.
   * Không ghi DB ở đây.
   */
  return {
    sourcePost: {
      id: sourcePost.id,
      rootPostId,

      title: sourcePost.title,
      content: sourcePost.content,

      thumbnailUrl:
        sourcePost.thumbnailUrl,

      language:
        sourcePost.language,
    },

    translation: {
      language: targetLanguage,

      title: translated.title,
      content: translated.content,
    },
  };
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

  /**
   * Chỉ sao chép những tag chưa bị soft-delete.
   */
  postTags: {
    where: {
      tag: {
        deletedAt: null,
      },
    },

    select: {
      tagId: true,
    },
  },
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
        isActive: true,
      },
    });

    if (!targetLanguage) {
      throw new BadRequestException(
        `Ngôn ngữ đích có ID ${dto.targetLanguageId} không tồn tại hoặc đang bị vô hiệu hóa.`,
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