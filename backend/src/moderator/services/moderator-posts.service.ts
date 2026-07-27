import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';

import {
  PaginatedResult,
  PaginationParams,
  PostNotFoundException,
  PrismaService,
} from '@app/core';

import {
  GetModeratorPostsDto,
  RejectModeratorPostDto,
} from '../dto';
import { ModeratorPostEntity } from '../entities';

/**
 * Các trạng thái Moderator được phép xem.
 *
 * DRAFT không xuất hiện vì Blog Owner chưa gửi bài đi duyệt.
 */
const MODERATOR_VISIBLE_STATUSES: PostStatus[] = [
  PostStatus.PENDING_REVIEW,
  PostStatus.PUBLISH,
  PostStatus.REJECT,
];

/**
 * Các quan hệ cần trả cho màn hình kiểm duyệt bài viết.
 */
const MODERATOR_POST_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
    },
  },

  language: true,

  reviewedBy: {
    select: {
      id: true,
      username: true,
      avatarUrl: true,
    },
  },

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
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.PostInclude;

@Injectable()
export class ModeratorPostsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Danh sách bài Moderator được phép xem.
   *
   * Mặc định:
   * - chỉ lấy PENDING_REVIEW;
   * - bài chờ lâu nhất hiển thị trước.
   *
   * Có thể lọc:
   * - PENDING_REVIEW;
   * - PUBLISH;
   * - REJECT.
   */
  async findAll(
    query: GetModeratorPostsDto,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ModeratorPostEntity>> {
    const {
      search,
      categoryId,
      languageId,
      authorId,
      tagId,
      tagName,
    } = query;

    const { skip, take, page } = pagination;

    const status = query.status ?? PostStatus.PENDING_REVIEW;

    /*
     * DTO đã kiểm tra status, nhưng service vẫn kiểm tra lại
     * để đảm bảo an toàn khi được gọi từ nơi khác.
     */
    if (!MODERATOR_VISIBLE_STATUSES.includes(status)) {
      throw new BadRequestException(
        'Moderator chỉ được xem bài PENDING_REVIEW, PUBLISH hoặc REJECT.',
      );
    }

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status,
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

    if (authorId !== undefined) {
      where.authorId = authorId;
    }

    if (tagId !== undefined) {
      where.postTags = {
        some: {
          tagId,
        },
      };
    } else if (tagName) {
      const tag = await this.prisma.tag.findFirst({
        where: {
          name: tagName,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (tag) {
        where.postTags = {
          some: {
            tagId: tag.id,
          },
        };
      } else {
        /*
         * Tag không tồn tại thì tạo điều kiện không thể khớp.
         */
        where.id = -1;
      }
    }

    /*
     * Bài đang chờ duyệt:
     * - bài gửi trước được xử lý trước.
     *
     * Bài đã xử lý:
     * - bài xử lý gần nhất hiển thị trước.
     */
    const orderBy: Prisma.PostOrderByWithRelationInput =
      status === PostStatus.PENDING_REVIEW
        ? {
            updatedAt: 'asc',
          }
        : {
            reviewedAt: 'desc',
          };

    const [posts, totalItems] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take,
        orderBy,
        include: MODERATOR_POST_INCLUDE,
      }),

      this.prisma.post.count({
        where,
      }),
    ]);

    return {
      items: posts.map(
        (post) => new ModeratorPostEntity(post),
      ),

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
   * Xem chi tiết một bài viết.
   *
   * Moderator không được xem bài DRAFT.
   */
  async findOne(postId: number): Promise<ModeratorPostEntity> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
        status: {
          in: MODERATOR_VISIBLE_STATUSES,
        },
      },
      include: MODERATOR_POST_INCLUDE,
    });

    if (!post) {
      throw new PostNotFoundException(postId.toString());
    }

    return new ModeratorPostEntity(post);
  }

  /**
   * Duyệt bài viết.
   *
   * PENDING_REVIEW -> PUBLISH
   */
  async approve(
    moderatorId: number,
    postId: number,
  ): Promise<ModeratorPostEntity> {
    const updatedPost = await this.prisma.$transaction(
      async (tx) => {
        const post = await tx.post.findFirst({
          where: {
            id: postId,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
            publishedAt: true,
          },
        });

        if (!post) {
          throw new PostNotFoundException(
            postId.toString(),
          );
        }

        if (post.status !== PostStatus.PENDING_REVIEW) {
          throw new BadRequestException(
            `Chỉ có thể duyệt bài viết đang ở trạng thái PENDING_REVIEW. Trạng thái hiện tại: ${post.status}.`,
          );
        }

        const reviewedAt = new Date();

        /*
         * updateMany có điều kiện trạng thái để chống trường hợp
         * hai Moderator xử lý cùng một bài cùng lúc.
         */
        const updateResult = await tx.post.updateMany({
          where: {
            id: postId,
            status: PostStatus.PENDING_REVIEW,
            deletedAt: null,
          },
          data: {
            status: PostStatus.PUBLISH,
            reviewedById: moderatorId,
            reviewedAt,
            rejectionReason: null,

            /*
             * Bài xuất bản lần đầu:
             * publishedAt = thời điểm duyệt.
             *
             * Bài đã từng xuất bản rồi được sửa:
             * giữ publishedAt cũ.
             */
            publishedAt:
              post.publishedAt ?? reviewedAt,
          },
        });

        if (updateResult.count !== 1) {
          throw new ConflictException(
            'Bài viết đã được Moderator khác xử lý. Vui lòng tải lại dữ liệu.',
          );
        }

        const result = await tx.post.findFirst({
          where: {
            id: postId,
            deletedAt: null,
          },
          include: MODERATOR_POST_INCLUDE,
        });

        if (!result) {
          throw new PostNotFoundException(
            postId.toString(),
          );
        }

        return result;
      },
    );

    return new ModeratorPostEntity(updatedPost);
  }

  /**
   * Từ chối bài viết.
   *
   * PENDING_REVIEW -> REJECT
   */
  async reject(
    moderatorId: number,
    postId: number,
    dto: RejectModeratorPostDto,
  ): Promise<ModeratorPostEntity> {
    const updatedPost = await this.prisma.$transaction(
      async (tx) => {
        const post = await tx.post.findFirst({
          where: {
            id: postId,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (!post) {
          throw new PostNotFoundException(
            postId.toString(),
          );
        }

        if (post.status !== PostStatus.PENDING_REVIEW) {
          throw new BadRequestException(
            `Chỉ có thể từ chối bài viết đang ở trạng thái PENDING_REVIEW. Trạng thái hiện tại: ${post.status}.`,
          );
        }

        const reviewedAt = new Date();

        const updateResult = await tx.post.updateMany({
          where: {
            id: postId,
            status: PostStatus.PENDING_REVIEW,
            deletedAt: null,
          },
          data: {
            status: PostStatus.REJECT,
            reviewedById: moderatorId,
            reviewedAt,
            rejectionReason: dto.rejectionReason,

            /*
             * Không xóa publishedAt.
             *
             * Bài từng được xuất bản rồi sửa lại vẫn cần giữ
             * thời điểm xuất bản ban đầu.
             */
          },
        });

        if (updateResult.count !== 1) {
          throw new ConflictException(
            'Bài viết đã được Moderator khác xử lý. Vui lòng tải lại dữ liệu.',
          );
        }

        const result = await tx.post.findFirst({
          where: {
            id: postId,
            deletedAt: null,
          },
          include: MODERATOR_POST_INCLUDE,
        });

        if (!result) {
          throw new PostNotFoundException(
            postId.toString(),
          );
        }

        return result;
      },
    );

    return new ModeratorPostEntity(updatedPost);
  }
}