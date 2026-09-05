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
  PostsService,
  PrismaService,
} from '@app/core';

import { GetModeratorPostsDto, RejectModeratorPostDto } from '../dto';
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
 * Dữ liệu tóm tắt của các phiên bản ngôn ngữ.
 *
 * Full content không nhét hết vào đây để response detail
 * không quá lớn.
 *
 * Khi Moderator chọn một language tab,
 * frontend gọi GET /moderator/posts/:id để lấy full version.
 */
const MODERATOR_TRANSLATION_SELECT = {
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
} satisfies Prisma.PostSelect;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
  ) {}

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

    const result = await this.postsService.findAll(
      {
        ...query,
        status,
      },

      pagination,

      MODERATOR_POST_INCLUDE,

      orderBy,

      /**
       * Moderator list chỉ lấy bài gốc.
       *
       * Translations có cùng trạng thái với root
       * nhưng không được tạo thành row riêng.
       */
      {
        parentPostId: null,
      },
    );

    const rootPostIds = result.items.map((post) => post.id);

    const translations =
      rootPostIds.length > 0
        ? await this.prisma.post.findMany({
            where: {
              parentPostId: {
                in: rootPostIds,
              },
              deletedAt: null,
              status: {
                in: MODERATOR_VISIBLE_STATUSES,
              },
            },
            select: MODERATOR_TRANSLATION_SELECT,
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
          })
        : [];

    const translationsByRoot = new Map<number, typeof translations>();

    for (const translation of translations) {
      if (translation.parentPostId === null) {
        continue;
      }

      const current =
        translationsByRoot.get(translation.parentPostId) ?? [];

      current.push(translation);

      translationsByRoot.set(
        translation.parentPostId,
        current,
      );
    }

    return {
      ...result,
      items: result.items.map(
        (post) =>
          new ModeratorPostEntity({
            ...post,
            translations:
              translationsByRoot.get(post.id) ?? [],
          }),
      ),
    };
  }

  /**
   * Xem chi tiết một bài viết.
   *
   * Moderator không được xem bài DRAFT.
   */
  async findOne(postId: number): Promise<ModeratorPostEntity> {
    /**
     * =========================================
     * 1. LẤY FULL CONTENT CỦA VERSION ĐANG XEM
     * =========================================
     */
    const post = await this.postsService.findOne(
      postId,
      MODERATOR_POST_INCLUDE,
    );

    /**
     * Moderator không được xem DRAFT.
     */
    if (!MODERATOR_VISIBLE_STATUSES.includes(post.status)) {
      throw new PostNotFoundException(postId.toString());
    }

    /**
     * =========================================
     * 2. XÁC ĐỊNH ROOT CỦA POST GROUP
     * =========================================
     *
     * ROOT:
     * parentPostId = null
     *
     * Translation:
     * parentPostId = ROOT ID
     */
    const rootPostId = post.parentPostId ?? post.id;

    /**
     * =========================================
     * 3. LẤY DANH SÁCH CÁC VERSION
     * =========================================
     *
     * Giống BlogOwner findOne().
     *
     * Chỉ trả summary:
     * - id
     * - title
     * - language
     * - status
     *
     * Không trả full content tất cả phiên bản một lúc.
     */
    const translations = await this.prisma.post.findMany({
      where: {
        authorId: post.authorId,
        deletedAt: null,

        status: {
          in: MODERATOR_VISIBLE_STATUSES,
        },

        OR: [
          {
            id: rootPostId,
          },
          {
            parentPostId: rootPostId,
          },
        ],
      },

      select: MODERATOR_TRANSLATION_SELECT,

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

    /**
     * Bảo vệ dữ liệu cũ:
     * group phải còn ROOT.
     */
    const rootExists = translations.some(
      (version) => version.id === rootPostId && version.parentPostId === null,
    );

    if (!rootExists) {
      throw new PostNotFoundException(rootPostId.toString());
    }

    return new ModeratorPostEntity({
      ...post,
      translations,
    });
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
    const updatedPost = await this.prisma.$transaction(async (tx) => {
      /**
       * =============================================
       * 1. TÌM POST ĐƯỢC MODERATOR CLICK
       * =============================================
       */
      const selectedPost = await tx.post.findFirst({
        where: {
          id: postId,
          deletedAt: null,
        },

        select: {
          id: true,
          parentPostId: true,
          status: true,
        },
      });

      if (!selectedPost) {
        throw new PostNotFoundException(postId.toString());
      }

      /**
       * Moderator chỉ approve ROOT.
       *
       * Translation không còn được duyệt riêng.
       */
      if (selectedPost.parentPostId !== null) {
        throw new BadRequestException(
          'Chỉ được duyệt bài gốc. Các bản dịch sẽ được duyệt cùng bài gốc.',
        );
      }

      const rootPostId = selectedPost.id;

      /**
       * =============================================
       * 2. LẤY TOÀN BỘ GROUP
       * =============================================
       */
      const groupPosts = await tx.post.findMany({
        where: {
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

        select: {
          id: true,
          parentPostId: true,
          status: true,
          publishedAt: true,
        },
      });

      const root = groupPosts.find(
        (post) => post.id === rootPostId && post.parentPostId === null,
      );

      if (!root) {
        throw new PostNotFoundException(rootPostId.toString());
      }

      /**
       * =============================================
       * 3. CẢ GROUP PHẢI ĐANG PENDING_REVIEW
       * =============================================
       *
       * Flow mới bình thường luôn cùng status.
       * Check toàn bộ để bắt dữ liệu cũ bị lệch.
       */
      const invalidPost = groupPosts.find(
        (post) => post.status !== PostStatus.PENDING_REVIEW,
      );

      if (invalidPost) {
        throw new BadRequestException(
          `Không thể duyệt bài viết vì toàn bộ bài gốc và bản dịch phải ở trạng thái PENDING_REVIEW. Post ID ${invalidPost.id} hiện đang ở trạng thái ${invalidPost.status}.`,
        );
      }

      const reviewedAt = new Date();

      /**
       * =============================================
       * 4. CLAIM ROOT TRƯỚC
       * =============================================
       *
       * Giữ cơ chế chống 2 Moderator cùng xử lý.
       */
      const rootUpdateResult = await tx.post.updateMany({
        where: {
          id: rootPostId,
          parentPostId: null,
          status: PostStatus.PENDING_REVIEW,
          deletedAt: null,
        },

        data: {
          status: PostStatus.PUBLISH,

          reviewedById: moderatorId,

          reviewedAt,

          rejectionReason: null,

          /**
           * Nếu bài từng publish:
           * giữ publishedAt cũ.
           *
           * Nếu publish lần đầu:
           * dùng reviewedAt.
           */
          publishedAt: root.publishedAt ?? reviewedAt,
        },
      });

      if (rootUpdateResult.count !== 1) {
        throw new ConflictException(
          'Bài viết đã được Moderator khác xử lý. Vui lòng tải lại dữ liệu.',
        );
      }

      /**
       * =============================================
       * 5. APPROVE TẤT CẢ TRANSLATIONS
       * =============================================
       *
       * Update riêng từng translation để giữ
       * publishedAt cũ của từng version.
       */
      const translations = groupPosts.filter(
        (post) => post.parentPostId === rootPostId,
      );

      for (const translation of translations) {
        const translationUpdateResult = await tx.post.updateMany({
          where: {
            id: translation.id,

            parentPostId: rootPostId,

            status: PostStatus.PENDING_REVIEW,

            deletedAt: null,
          },

          data: {
            status: PostStatus.PUBLISH,

            reviewedById: moderatorId,

            reviewedAt,

            rejectionReason: null,

            publishedAt: translation.publishedAt ?? reviewedAt,
          },
        });

        /**
         * Nếu một translation bị Moderator/request khác
         * thay đổi giữa lúc xử lý:
         *
         * throw -> Prisma rollback cả transaction.
         */
        if (translationUpdateResult.count !== 1) {
          throw new ConflictException(
            'Bài viết hoặc một bản dịch đã được xử lý bởi yêu cầu khác. Vui lòng tải lại dữ liệu.',
          );
        }
      }

      /**
       * =============================================
       * 6. TRẢ ROOT
       * =============================================
       */
      const result = await tx.post.findFirst({
        where: {
          id: rootPostId,
          parentPostId: null,
          deletedAt: null,
        },

        include: MODERATOR_POST_INCLUDE,
      });

      if (!result) {
        throw new PostNotFoundException(rootPostId.toString());
      }

      return result;
    });

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
    const updatedPost = await this.prisma.$transaction(async (tx) => {
      /**
       * =============================================
       * 1. TÌM ROOT
       * =============================================
       */
      const selectedPost = await tx.post.findFirst({
        where: {
          id: postId,
          deletedAt: null,
        },

        select: {
          id: true,
          parentPostId: true,
          status: true,
        },
      });

      if (!selectedPost) {
        throw new PostNotFoundException(postId.toString());
      }

      /**
       * Không reject riêng translation.
       */
      if (selectedPost.parentPostId !== null) {
        throw new BadRequestException(
          'Chỉ được từ chối bài gốc. Các bản dịch sẽ bị từ chối cùng bài gốc.',
        );
      }

      const rootPostId = selectedPost.id;

      /**
       * =============================================
       * 2. LẤY TOÀN GROUP
       * =============================================
       */
      const groupPosts = await tx.post.findMany({
        where: {
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

        select: {
          id: true,
          parentPostId: true,
          status: true,
        },
      });

      const root = groupPosts.find(
        (post) => post.id === rootPostId && post.parentPostId === null,
      );

      if (!root) {
        throw new PostNotFoundException(rootPostId.toString());
      }

      /**
       * =============================================
       * 3. TOÀN GROUP PHẢI PENDING_REVIEW
       * =============================================
       */
      const invalidPost = groupPosts.find(
        (post) => post.status !== PostStatus.PENDING_REVIEW,
      );

      if (invalidPost) {
        throw new BadRequestException(
          `Không thể từ chối bài viết vì toàn bộ bài gốc và bản dịch phải ở trạng thái PENDING_REVIEW. Post ID ${invalidPost.id} hiện đang ở trạng thái ${invalidPost.status}.`,
        );
      }

      const reviewedAt = new Date();

      /**
       * =============================================
       * 4. CLAIM ROOT
       * =============================================
       */
      const rootUpdateResult = await tx.post.updateMany({
        where: {
          id: rootPostId,

          parentPostId: null,

          status: PostStatus.PENDING_REVIEW,

          deletedAt: null,
        },

        data: {
          status: PostStatus.REJECT,

          reviewedById: moderatorId,

          reviewedAt,

          rejectionReason: dto.rejectionReason,

          /**
           * Không sửa publishedAt.
           *
           * Nếu bài từng được publish trước đây,
           * thời gian publish cũ vẫn được giữ.
           */
        },
      });

      if (rootUpdateResult.count !== 1) {
        throw new ConflictException(
          'Bài viết đã được Moderator khác xử lý. Vui lòng tải lại dữ liệu.',
        );
      }

      /**
       * =============================================
       * 5. REJECT TRANSLATIONS
       * =============================================
       */
      const translations = groupPosts.filter(
        (post) => post.parentPostId === rootPostId,
      );

      for (const translation of translations) {
        const translationUpdateResult = await tx.post.updateMany({
          where: {
            id: translation.id,

            parentPostId: rootPostId,

            status: PostStatus.PENDING_REVIEW,

            deletedAt: null,
          },

          data: {
            status: PostStatus.REJECT,

            reviewedById: moderatorId,

            reviewedAt,

            /**
             * Cả group dùng cùng lý do reject.
             */
            rejectionReason: dto.rejectionReason,
          },
        });

        if (translationUpdateResult.count !== 1) {
          throw new ConflictException(
            'Bài viết hoặc một bản dịch đã được xử lý bởi yêu cầu khác. Vui lòng tải lại dữ liệu.',
          );
        }
      }

      /**
       * =============================================
       * 6. TRẢ ROOT
       * =============================================
       */
      const result = await tx.post.findFirst({
        where: {
          id: rootPostId,
          parentPostId: null,
          deletedAt: null,
        },

        include: MODERATOR_POST_INCLUDE,
      });

      if (!result) {
        throw new PostNotFoundException(rootPostId.toString());
      }

      return result;
    });

    return new ModeratorPostEntity(updatedPost);
  }
}
