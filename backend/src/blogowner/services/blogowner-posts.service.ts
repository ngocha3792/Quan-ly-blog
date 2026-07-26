import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
  BlogownerPostEntity,
  CreateBlogownerPostDto,
  GetBlogownerPostsDto,
  NotPostOwnerException,
  PaginatedResult,
  PaginationParams,
  PostNotFoundException,
  PostsService,
  PrismaService,
  TranslateBlogownerPostDto,
  UpdateBlogownerPostDto,
} from '@app/core';

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
  ) {}

  /**
   * Xem toàn bộ bài viết của Blog Owner đang đăng nhập.
   */
  async findAll(
    ownerId: number,
    query: GetBlogownerPostsDto,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BlogownerPostEntity>> {
    const {
      search,
      categoryId,
      languageId,
      parentPostId,
      status,
      tagId,
      tagName,
    } = query;

    const { skip, take, page } = pagination;

    const where: Prisma.PostWhereInput = {
      authorId: ownerId,
      deletedAt: null,
    };

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (categoryId !== undefined) {
      where.postCategories = {
        some: {
          categoryId,
        },
      };
    }

    if (languageId !== undefined) {
      where.languageId = languageId;
    }

    if (parentPostId !== undefined) {
      where.parentPostId = parentPostId;
    }

    if (status !== undefined) {
      where.status = status;
    }

    if (tagId !== undefined) {
      where.postTags = {
        some: {
          tagId,
        },
      };
    } else if (tagName) {
      where.postTags = {
        some: {
          tag: {
            name: {
              equals: tagName,
              mode: 'insensitive',
            },
            deletedAt: null,
          },
        },
      };
    }

    const [posts, totalItems] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: BLOGOWNER_POST_INCLUDE,
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take,
      }),

      this.prisma.post.count({
        where,
      }),
    ]);

    return {
      items: posts.map((post) => new BlogownerPostEntity(post)),

      meta: {
        totalItems,
        itemCount: posts.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take),
        currentPage: page,
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
  async findOne(ownerId: number, postId: number): Promise<BlogownerPostEntity> {
    const post = await this.findOwnedPost(ownerId, postId);

    return new BlogownerPostEntity(post);
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
  ): Promise<BlogownerPostEntity> {
    const createdPost = await this.postsService.create(ownerId, {
      ...dto,
      status: PostStatus.DRAFT,
    });

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
  ): Promise<BlogownerPostEntity> {
    const existingPost = await this.findOwnedPost(ownerId, postId);

    if (existingPost.status === PostStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Bài viết đang chờ Moderator duyệt nên không thể chỉnh sửa.',
      );
    }

    let nextStatus: PostStatus = existingPost.status;

    if (existingPost.status === PostStatus.REJECT) {
      nextStatus = PostStatus.DRAFT;
    }

    if (existingPost.status === PostStatus.PUBLISH) {
      nextStatus = PostStatus.PENDING_REVIEW;
    }

    /*
     * PostsService xử lý:
     * - title;
     * - thumbnailUrl;
     * - content;
     * - categoryIds;
     * - tagIds;
     * - tagNames.
     */
    await this.postsService.update(postId, {
      ...dto,
      status: nextStatus,
    });

    /*
     * Khi bài bị từ chối được sửa lại hoặc bài đã xuất bản
     * được cập nhật, xóa thông tin kiểm duyệt cũ.
     *
     * publishedAt không bị thay đổi.
     */
    if (
      existingPost.status === PostStatus.REJECT ||
      existingPost.status === PostStatus.PUBLISH
    ) {
      await this.prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
    }

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
    await this.findOwnedPost(ownerId, postId);

    await this.postsService.remove(postId);

    return {
      message: `Đã xóa bài viết có ID ${postId}.`,
    };
  }

  /**
   * Gửi bài sang Moderator để kiểm duyệt.
   *
   * Chỉ cho phép:
   * - DRAFT  -> PENDING_REVIEW
   * - REJECT -> PENDING_REVIEW
   */
  async submitForReview(
    ownerId: number,
    postId: number,
  ): Promise<BlogownerPostEntity> {
    const post = await this.findOwnedPost(ownerId, postId);

    if (post.status === PostStatus.PENDING_REVIEW) {
      throw new BadRequestException('Bài viết này đang chờ Moderator duyệt.');
    }

    if (post.status === PostStatus.PUBLISH) {
      throw new BadRequestException(
        'Bài viết đã được xuất bản. Chỉ khi chỉnh sửa bài thì bài mới được gửi duyệt lại.',
      );
    }

    if (post.status !== PostStatus.DRAFT && post.status !== PostStatus.REJECT) {
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
    const sourcePost = await this.findOwnedPost(ownerId, sourcePostId);

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

    if (existingTranslation) {
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

  /**
   * Tìm bài viết chưa bị xóa và kiểm tra quyền sở hữu.
   *
   * Không cho Blog Owner sửa/xóa bài của người khác.
   */
  private async findOwnedPost(ownerId: number, postId: number) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },

      include: BLOGOWNER_POST_INCLUDE,
    });

    if (!post) {
      throw new PostNotFoundException(postId.toString());
    }

    if (post.authorId !== ownerId) {
      throw new NotPostOwnerException();
    }

    return post;
  }
}
