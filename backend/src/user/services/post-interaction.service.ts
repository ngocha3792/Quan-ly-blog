import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  PostNotFoundException,
  ExistActionNotAllowedException,
} from '@app/core/common/exceptions';
import {
  PostLikeEntity,
  PostBookmarkEntity,
} from '@app/core/modules/posts/entities';
import type { PaginationParams, PaginatedResult } from '@app/core';
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

    const postLike = await this.prisma.postLike.upsert({
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

    return new PostLikeEntity(postLike);
  }

  async unlikePost(userId: number, postId: number) {
    await this.findOnePost(postId);

    await this.prisma.postLike.deleteMany({
      where: {
        postId,
        userId,
      },
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
