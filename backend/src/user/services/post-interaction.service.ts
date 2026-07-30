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

    const existingLike = await this.prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (existingLike) {
      throw new ExistActionNotAllowedException('thích', postId.toString());
    }

    const postLike = await this.prisma.postLike.create({
      data: {
        postId,
        userId,
      },
    });

    return new PostLikeEntity(postLike);
  }

  async unlikePost(userId: number, postId: number) {
    await this.findOnePost(postId);

    const existingLike = await this.prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (!existingLike) {
      throw new ExistActionNotAllowedException('bỏ thích', postId.toString());
    }

    await this.prisma.postLike.delete({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    return { message: 'Đã bỏ thích bài viết thành công' };
  }

  async bookmarkPost(userId: number, postId: number) {
    await this.findOnePost(postId);

    const existingBookmark = await this.prisma.postBookmark.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (existingBookmark) {
      throw new ExistActionNotAllowedException('lưu', postId.toString());
    }

    const postBookmark = await this.prisma.postBookmark.create({
      data: {
        postId,
        userId,
      },
    });

    return new PostBookmarkEntity(postBookmark);
  }

  async unbookmarkPost(userId: number, postId: number) {
    await this.findOnePost(postId);

    const existingBookmark = await this.prisma.postBookmark.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (!existingBookmark) {
      throw new ExistActionNotAllowedException('bỏ lưu', postId.toString());
    }

    await this.prisma.postBookmark.delete({
      where: {
        postId_userId: {
          postId,
          userId,
        },
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
