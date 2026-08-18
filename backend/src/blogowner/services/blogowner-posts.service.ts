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
import {
  BlogownerPostEntity,
  BlogownerPostGroup,
} from '../entities';
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

  _count: {
    select: {
      postLikes: true,
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
   *
   * Danh sách được phân trang theo NHÓM BÀI thay vì từng Post:
   * - root luôn đứng đầu nhóm;
   * - translations nằm ngay sau root;
   * - một nhóm chỉ tính là một item phân trang.
   *
   * Các filter được dùng để xác định nhóm nào khớp. Sau khi một nhóm
   * khớp, API trả lại toàn bộ phiên bản active của nhóm đó để frontend
   * luôn giữ được ngữ cảnh bài gốc -> các bản dịch.
   *
   * sortBy hỗ trợ:
   * - updatedAt: hoạt động mới nhất của bất kỳ phiên bản nào trong nhóm;
   * - viewCount: tổng lượt xem của cả nhóm;
   * - likeCount: tổng lượt thích của cả nhóm.
   */
  async findAll(
    ownerId: number,
    query: GetBlogownerPostsDto,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BlogownerPostGroup>> {
    const matchingWhere = this.buildGroupMatchWhere(ownerId, query);

    /**
     * Bước 1: tìm những Post active khớp filter với dữ liệu tối thiểu.
     * Từ mỗi Post suy ra rootPostId = parentPostId ?? id.
     */
    const matchingPosts = await this.prisma.post.findMany({
      where: matchingWhere,
      select: {
        id: true,
        parentPostId: true,
      },
    });

    const candidateRootIds = Array.from(
      new Set(
        matchingPosts.map((post) => post.parentPostId ?? post.id),
      ),
    );

    if (candidateRootIds.length === 0) {
      return this.emptyGroupedResult(pagination);
    }

    /**
     * Bước 2: chỉ giữ những nhóm vẫn còn bài gốc active.
     * Đây cũng là lớp bảo vệ cho dữ liệu cũ có thể từng tạo ra
     * translation mồ côi do root bị soft-delete riêng lẻ.
     */
    const activeRoots = await this.prisma.post.findMany({
      where: {
        id: {
          in: candidateRootIds,
        },
        authorId: ownerId,
        parentPostId: null,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const activeRootIds = activeRoots.map((root) => root.id);

    if (activeRootIds.length === 0) {
      return this.emptyGroupedResult(pagination);
    }

    /**
     * Bước 3: lấy metric tối thiểu của toàn bộ phiên bản trong các nhóm.
     * Dữ liệu này dùng để sort theo tổng view/like hoặc latestUpdatedAt.
     */
    const metricPosts = await this.prisma.post.findMany({
      where: {
        authorId: ownerId,
        deletedAt: null,
        OR: [
          {
            id: {
              in: activeRootIds,
            },
          },
          {
            parentPostId: {
              in: activeRootIds,
            },
          },
        ],
      },
      select: {
        id: true,
        parentPostId: true,
        updatedAt: true,
        viewCount: true,
        _count: {
          select: {
            postLikes: true,
          },
        },
      },
    });

    const groupedMetrics = new Map<
      number,
      {
        rootId: number;
        views: number;
        likes: number;
        latestUpdatedAt: Date;
      }
    >();

    for (const post of metricPosts) {
      const rootId = post.parentPostId ?? post.id;
      const current = groupedMetrics.get(rootId);

      if (!current) {
        groupedMetrics.set(rootId, {
          rootId,
          views: post.viewCount,
          likes: post._count.postLikes,
          latestUpdatedAt: post.updatedAt,
        });
        continue;
      }

      current.views += post.viewCount;
      current.likes += post._count.postLikes;

      if (post.updatedAt.getTime() > current.latestUpdatedAt.getTime()) {
        current.latestUpdatedAt = post.updatedAt;
      }
    }

    const sortBy = this.normalizeGroupSortBy(query.sortBy);
    const sortOrder = query.sortOrder ?? query.order ?? 'desc';
    const direction = sortOrder === 'asc' ? 1 : -1;

    const sortedMetrics = Array.from(groupedMetrics.values()).sort(
      (a, b) => {
        let comparison = 0;

        if (sortBy === 'viewCount') {
          comparison = a.views - b.views;
        } else if (sortBy === 'likeCount') {
          comparison = a.likes - b.likes;
        } else {
          comparison =
            a.latestUpdatedAt.getTime() - b.latestUpdatedAt.getTime();
        }

        if (comparison === 0) {
          comparison = a.rootId - b.rootId;
        }

        return comparison * direction;
      },
    );

    const totalItems = sortedMetrics.length;
    const pageMetrics = sortedMetrics.slice(
      pagination.skip,
      pagination.skip + pagination.take,
    );
    const pageRootIds = pageMetrics.map((item) => item.rootId);

    if (pageRootIds.length === 0) {
      return {
        items: [],
        meta: {
          totalItems,
          itemCount: 0,
          itemsPerPage: pagination.take,
          totalPages: Math.ceil(totalItems / pagination.take),
          currentPage: pagination.page,
        },
      };
    }

    /**
     * Bước 4: chỉ sau khi đã sort + paginate theo root mới lấy full data.
     * Nhờ vậy response luôn là:
     * root A -> toàn bộ translation A -> root B -> translation B...
     */
    const pagePosts = await this.prisma.post.findMany({
      where: {
        authorId: ownerId,
        deletedAt: null,
        OR: [
          {
            id: {
              in: pageRootIds,
            },
          },
          {
            parentPostId: {
              in: pageRootIds,
            },
          },
        ],
      },
      include: BLOGOWNER_POST_INCLUDE,
    });

    const groupMap = new Map<
      number,
      {
        root?: BlogownerPostEntity;
        translations: BlogownerPostEntity[];
      }
    >();

    for (const rootId of pageRootIds) {
      groupMap.set(rootId, {
        translations: [],
      });
    }

    for (const rawPost of pagePosts) {
      const post = new BlogownerPostEntity(rawPost);
      const rootId = post.parentPostId ?? post.id;
      const group = groupMap.get(rootId);

      if (!group) {
        continue;
      }

      if (post.parentPostId === null) {
        group.root = post;
      } else {
        group.translations.push(post);
      }
    }

    const metricsByRootId = new Map(
      pageMetrics.map((metric) => [metric.rootId, metric]),
    );

    const items: BlogownerPostGroup[] = [];

    for (const rootId of pageRootIds) {
      const group = groupMap.get(rootId);
      const metric = metricsByRootId.get(rootId);

      if (!group?.root || !metric) {
        continue;
      }

      group.translations.sort((a, b) => {
        const languageComparison = (a.language?.code ?? '').localeCompare(
          b.language?.code ?? '',
        );

        return languageComparison !== 0
          ? languageComparison
          : a.id - b.id;
      });

      items.push({
        root: group.root,
        translations: group.translations,
        totals: {
          views: metric.views,
          likes: metric.likes,
        },
        latestUpdatedAt: metric.latestUpdatedAt,
      });
    }

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: pagination.take,
        totalPages: Math.ceil(totalItems / pagination.take),
        currentPage: pagination.page,
      },
    };
  }

  /**
   * Tạo Prisma where cho việc xác định NHÓM nào khớp filter.
   * Khi một phiên bản trong nhóm khớp, findAll() sẽ trả toàn bộ nhóm.
   */
  private buildGroupMatchWhere(
    ownerId: number,
    query: GetBlogownerPostsDto,
  ): Prisma.PostWhereInput {
    const where: Prisma.PostWhereInput = {
      authorId: ownerId,
      deletedAt: null,
    };

    if (query.search) {
      where.title = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    if (query.categoryId) {
      where.postCategories = {
        some: {
          categoryId: query.categoryId,
        },
      };
    }

    if (query.languageId) {
      where.languageId = query.languageId;
    } else if (query.lang?.trim()) {
      where.language = {
        is: {
          code: {
            equals: query.lang.trim(),
            mode: 'insensitive',
          },
        },
      };
    }

    if (query.parentPostId) {
      where.parentPostId = query.parentPostId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.tagId) {
      where.postTags = {
        some: {
          tagId: query.tagId,
        },
      };
    } else if (query.tagName) {
      where.postTags = {
        some: {
          tag: {
            is: {
              name: query.tagName,
              deletedAt: null,
            },
          },
        },
      };
    }

    return where;
  }

  private normalizeGroupSortBy(
    sortBy?: string,
  ): 'updatedAt' | 'viewCount' | 'likeCount' {
    const normalized = sortBy?.trim().toLowerCase();

    if (
      normalized === 'viewcount' ||
      normalized === 'view' ||
      normalized === 'views'
    ) {
      return 'viewCount';
    }

    if (
      normalized === 'likecount' ||
      normalized === 'like' ||
      normalized === 'likes'
    ) {
      return 'likeCount';
    }

    return 'updatedAt';
  }

  private emptyGroupedResult(
    pagination: PaginationParams,
  ): PaginatedResult<BlogownerPostGroup> {
    return {
      items: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: pagination.take,
        totalPages: 0,
        currentPage: pagination.page,
      },
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
   * Đồng bộ lại một BẢN DỊCH từ bài gốc.
   *
   * POST /api/v1/blog-owner/posts/:id/sync-from-root
   *
   * Quy tắc:
   * - :id bắt buộc là ID của một bản dịch (parentPostId != null);
   * - chỉ cập nhật đúng bản dịch được chọn;
   * - không thay đổi bài gốc hoặc các bản dịch khác;
   * - title/content được dịch lại từ bài gốc;
   * - category được ánh xạ lại theo CategoryGroup sang ngôn ngữ bản dịch;
   * - tag active và thumbnail được đồng bộ lại từ bài gốc;
   * - media riêng, view, like, comment, bookmark... được giữ nguyên;
   * - DRAFT  -> DRAFT;
   * - REJECT -> DRAFT;
   * - PUBLISH -> PENDING_REVIEW;
   * - PENDING_REVIEW -> không cho đồng bộ.
   */
  async syncFromRoot(
    ownerId: number,
    translationPostId: number,
  ): Promise<BlogownerPostEntity> {
    /**
     * Dùng helper để đồng thời kiểm tra:
     * - post còn active;
     * - post thuộc đúng Blog Owner.
     */
    const translationPost = await this.helper.findOwnedPost(
      ownerId,
      translationPostId,
    );

    if (translationPost.parentPostId === null) {
      throw new BadRequestException(
        'Chỉ bản dịch mới có thể đồng bộ từ bài gốc.',
      );
    }

    /**
     * PENDING_REVIEW tuyệt đối không được thay đổi nội dung trong lúc
     * Moderator đang duyệt.
     */
    this.helper.assertEditable(translationPost.status);

    /**
     * Ngôn ngữ đích của bản dịch phải vẫn đang hoạt động.
     */
    const targetLanguage = await this.prisma.language.findFirst({
      where: {
        id: translationPost.languageId,
        deletedAt: null,
        isActive: true,
      },
      select: LANGUAGE_SELECT,
    });

    if (!targetLanguage) {
      throw new BadRequestException(
        'Ngôn ngữ của bản dịch không tồn tại hoặc đang bị vô hiệu hóa.',
      );
    }

    /**
     * Luôn đồng bộ từ ROOT thật sự, không dùng một translation khác làm nguồn.
     */
    const rootPost = await this.prisma.post.findFirst({
      where: {
        id: translationPost.parentPostId,
        authorId: ownerId,
        parentPostId: null,
        deletedAt: null,
      },
      select: {
        id: true,
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

    if (!rootPost) {
      throw new BadRequestException(
        'Không tìm thấy bài gốc còn hoạt động của bản dịch này.',
      );
    }

    /**
     * Lấy CategoryGroup của root rồi map sang category cùng group,
     * đúng ngôn ngữ của translation.
     */
    const categoryGroupIds = Array.from(
      new Set(
        rootPost.postCategories.map(
          (postCategory) => postCategory.category.categoryGroupId,
        ),
      ),
    );

    if (categoryGroupIds.length === 0) {
      throw new BadRequestException(
        'Bài gốc chưa có danh mục nên không thể đồng bộ bản dịch.',
      );
    }

    const translatedCategories = await this.prisma.category.findMany({
      where: {
        categoryGroupId: {
          in: categoryGroupIds,
        },
        languageId: translationPost.languageId,
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

    const translatedCategoryGroupIds = new Set(
      translatedCategories.map((category) => category.categoryGroupId),
    );

    if (translatedCategoryGroupIds.size !== categoryGroupIds.length) {
      throw new BadRequestException(
        'Một hoặc nhiều danh mục của bài gốc chưa có phiên bản trong ngôn ngữ của bản dịch.',
      );
    }

    /**
     * Validation hoàn tất mới gọi LibreTranslate để tránh gọi dịch vụ ngoài
     * khi chắc chắn request sẽ thất bại vì category/language.
     */
    const translated = await this.translationService.translatePost({
      title: rootPost.title,
      content: rootPost.content,
      sourceLanguageCode: rootPost.language.code,
      targetLanguageCode: targetLanguage.code,
    });

    const sourceTagIds = rootPost.postTags.map((postTag) => postTag.tagId);
    const nextStatus = this.helper.getNextStatusOnEdit(
      translationPost.status,
    );

    /**
     * Một Prisma update duy nhất để title/content/category/tag/status cùng
     * thành công hoặc cùng thất bại.
     *
     * Không ghi viewCount và không đụng PostLike => view/like được giữ nguyên.
     * Không đụng media => media riêng của translation được giữ nguyên.
     */
    await this.prisma.post.update({
      where: {
        id: translationPostId,
      },
      data: {
        title: translated.title,
        content: translated.content,
        thumbnailUrl: rootPost.thumbnailUrl,
        status: nextStatus,
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

    return this.findOne(ownerId, translationPostId);
  }

  /**
   * Đồng bộ TẤT CẢ bản dịch từ một bài gốc.
   *
   * POST /api/v1/blog-owner/posts/:id/sync-all-translations
   *
   * Quy tắc:
   * - :id bắt buộc là ID bài gốc (parentPostId = null);
   * - lần lượt đồng bộ từng bản dịch active của bài gốc;
   * - PENDING_REVIEW tuyệt đối không dịch và được đưa vào skipped;
   * - DRAFT          -> DRAFT;
   * - REJECT         -> DRAFT;
   * - PUBLISH        -> PENDING_REVIEW;
   * - một bản dịch lỗi không rollback những bản đã đồng bộ thành công;
   * - view/like/comment/bookmark/media riêng của từng bản dịch được giữ nguyên
   *   vì syncFromRoot() chỉ cập nhật dữ liệu nội dung của chính Post đó.
   */
  async syncAllTranslations(
    ownerId: number,
    rootPostId: number,
  ): Promise<{
    rootPostId: number;
    totalTranslations: number;
    synced: Array<{
      id: number;
      languageCode: string;
      status: PostStatus;
    }>;
    skipped: Array<{
      id: number;
      languageCode: string;
      status: PostStatus;
      reason: string;
    }>;
    failed: Array<{
      id: number;
      languageCode: string;
      status: PostStatus;
      reason: string;
    }>;
  }> {
    /**
     * helper.findOwnedPost() xác nhận bài còn active và thuộc đúng Owner.
     * Không gọi assertEditable() trên root vì root có thể vừa được sửa từ
     * PUBLISH -> PENDING_REVIEW; Owner vẫn được phép dùng nội dung root mới
     * làm nguồn để đồng bộ các bản dịch.
     */
    const rootPost = await this.helper.findOwnedPost(
      ownerId,
      rootPostId,
    );

    if (rootPost.parentPostId !== null) {
      throw new BadRequestException(
        'Chỉ bài gốc mới có thể đồng bộ tất cả bản dịch.',
      );
    }

    const translations = await this.prisma.post.findMany({
      where: {
        authorId: ownerId,
        parentPostId: rootPostId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        language: {
          select: {
            code: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    const synced: Array<{
      id: number;
      languageCode: string;
      status: PostStatus;
    }> = [];

    const skipped: Array<{
      id: number;
      languageCode: string;
      status: PostStatus;
      reason: string;
    }> = [];

    const failed: Array<{
      id: number;
      languageCode: string;
      status: PostStatus;
      reason: string;
    }> = [];

    /**
     * Xử lý tuần tự để tránh dồn nhiều request nặng vào LibreTranslate
     * cùng lúc trên môi trường local.
     */
    for (const translation of translations) {
      const languageCode = translation.language.code;

      if (translation.status === PostStatus.PENDING_REVIEW) {
        skipped.push({
          id: translation.id,
          languageCode,
          status: translation.status,
          reason:
            'Bản dịch đang chờ Moderator duyệt nên không được đồng bộ.',
        });
        continue;
      }

      try {
        const syncedPost = await this.syncFromRoot(
          ownerId,
          translation.id,
        );

        synced.push({
          id: translation.id,
          languageCode,
          status: syncedPost.status,
        });
      } catch (error: unknown) {
        failed.push({
          id: translation.id,
          languageCode,
          status: translation.status,
          reason:
            error instanceof Error
              ? error.message
              : 'Không thể đồng bộ bản dịch này.',
        });
      }
    }

    return {
      rootPostId,
      totalTranslations: translations.length,
      synced,
      skipped,
      failed,
    };
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