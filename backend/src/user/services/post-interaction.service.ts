import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostNotFoundException } from '@app/core/common/exceptions';
import {
  PostLikeEntity,
  PostBookmarkEntity,
} from '@app/core/modules/posts/entities';
import {
  getVietnamCalendarDate,
  type PaginationParams,
  type PaginatedResult,
} from '@app/core';
import { Prisma } from '@prisma/client';
import { UserPostEntity } from '../entities';

const POST_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      bio: true,
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
  language: true,
  postTags: {
    include: {
      tag: true,
    },
  },
  media: true,
  _count: {
    select: {
      postLikes: true,
    },
  },
} satisfies Prisma.PostInclude;

@Injectable()
export class PostInteractionService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOnePost(id: number) {
    const post = await this.prisma.post.findFirst({
      where: {
        id,
        deletedAt: null,
        status: 'PUBLISH',
      },
    });

    if (!post) {
      throw new PostNotFoundException(id.toString());
    }
    return post;
  }

async likePost(userId: number, postId: number) {
  await this.findOnePost(postId);

  const metricDate = getVietnamCalendarDate();

  const postLike = await this.prisma.$transaction(async (tx) => {
    /**
     * createMany + skipDuplicates giúp thao tác LIKE idempotent.
     *
     * Nếu user chưa like:
     * count = 1
     *
     * Nếu đã like:
     * count = 0
     */
    const created = await tx.postLike.createMany({
      data: [
        {
          postId,
          userId,
        },
      ],
      skipDuplicates: true,
    });

    /**
     * Chỉ khi thực sự tạo một like mới
     * mới tăng analytics của ngày hôm nay.
     */
    if (created.count > 0) {
      await tx.postDailyMetric.upsert({
        where: {
          postId_metricDate: {
            postId,
            metricDate,
          },
        },
        create: {
          postId,
          metricDate,
          viewCount: 0,
          likeCount: 1,
        },
        update: {
          likeCount: {
            increment: 1,
          },
        },
      });
    }

    return tx.postLike.findUniqueOrThrow({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });
  });

  return new PostLikeEntity(postLike);
}

async unlikePost(userId: number, postId: number) {
  await this.findOnePost(postId);

  const metricDate = getVietnamCalendarDate();

  await this.prisma.$transaction(async (tx) => {
    const deleted = await tx.postLike.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    /**
     * Chỉ khi thực sự xóa một PostLike
     * mới ghi biến động -1 cho ngày hôm nay.
     *
     * Vì PostDailyMetric.likeCount là NET CHANGE:
     *
     * like   = +1
     * unlike = -1
     */
    if (deleted.count > 0) {
      await tx.postDailyMetric.upsert({
        where: {
          postId_metricDate: {
            postId,
            metricDate,
          },
        },
        create: {
          postId,
          metricDate,
          viewCount: 0,
          likeCount: -1,
        },
        update: {
          likeCount: {
            decrement: 1,
          },
        },
      });
    }
  });

  return { message: 'Đã bỏ thích bài viết thành công' };
}

  async bookmarkPost(userId: number, postId: number) {
    await this.findOnePost(postId);

    const postBookmark = await this.prisma.postBookmark.upsert({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
      update: {},
      create: {
        postId,
        userId,
      },
    });

    return new PostBookmarkEntity(postBookmark);
  }

  async unbookmarkPost(userId: number, postId: number) {
    await this.findOnePost(postId);

    await this.prisma.postBookmark.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    return { message: 'Đã bỏ lưu bài viết thành công' };
  }

  async getBookmarkedPosts(
    userId: number,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<UserPostEntity>> {
    const { page = 1, skip = 0, take = 10 } = pagination || {};

    const where: Prisma.PostBookmarkWhereInput = {
      userId,
      post: {
        deletedAt: null,
        status: 'PUBLISH',
      },
    };

    const [totalItems, bookmarks] = await Promise.all([
      this.prisma.postBookmark.count({ where }),
      this.prisma.postBookmark.findMany({
        where,
        include: {
          post: {
            include: POST_INCLUDE,
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = bookmarks.map((b) => new UserPostEntity(b.post));

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take) || 0,
        currentPage: page,
      },
    };
  }

  async getLikedPosts(
    userId: number,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<UserPostEntity>> {
    const { page = 1, skip = 0, take = 10 } = pagination || {};

    const where: Prisma.PostLikeWhereInput = {
      userId,
      post: {
        deletedAt: null,
        status: 'PUBLISH',
      },
    };

    const [totalItems, likes] = await Promise.all([
      this.prisma.postLike.count({ where }),
      this.prisma.postLike.findMany({
        where,
        include: {
          post: {
            include: POST_INCLUDE,
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = likes.map((l) => new UserPostEntity(l.post));

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take) || 0,
        currentPage: page,
      },
    };
  }
}
