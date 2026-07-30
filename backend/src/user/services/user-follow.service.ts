import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  SelfActionNotAllowedException,
  ExistActionNotAllowedException,
  UserNotFoundException,
} from '@app/core/common/exceptions';
import type { PaginationParams, PaginatedResult } from '@app/core';
import { UserFollowSummaryEntity } from '../entities';

@Injectable()
export class UserFollowService {
  constructor(private readonly prisma: PrismaService) {}

  async followUser(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new SelfActionNotAllowedException('follow');
    }

    const followingUser = await this.prisma.user.findFirst({
      where: {
        id: followingId,
        deletedAt: null,
      },
    });

    if (!followingUser) {
      throw new UserNotFoundException(followingId.toString());
    }

    const existingFollow = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      throw new ExistActionNotAllowedException(
        'follow',
        followingId.toString(),
      );
    }

    const userFollow = await this.prisma.userFollow.create({
      data: {
        followerId,
        followingId,
      },
    });

    return userFollow;
  }

  async unfollowUser(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new SelfActionNotAllowedException('unfollow');
    }

    const existingFollow = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!existingFollow) {
      throw new ExistActionNotAllowedException(
        'unfollow',
        followerId.toString(),
      );
    }

    await this.prisma.userFollow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return { message: 'Đã bỏ follow thành công' };
  }

  async getFollowerCount(userId: number): Promise<number> {
    return this.prisma.userFollow.count({
      where: { followingId: userId },
    });
  }

  async getFollowingCount(userId: number): Promise<number> {
    return this.prisma.userFollow.count({
      where: { followerId: userId },
    });
  }

  async getFollowers(
    userId: number,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<UserFollowSummaryEntity>> {
    const { page = 1, skip = 0, take = 10 } = pagination || {};
    const [totalItems, follows] = await Promise.all([
      this.prisma.userFollow.count({
        where: {
          followingId: userId,
          follower: {
            deletedAt: null,
          },
        },
      }),
      this.prisma.userFollow.findMany({
        where: {
          followingId: userId,
          follower: {
            deletedAt: null,
          },
        },
        select: {
          follower: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              bio: true,
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = follows.map((f) => new UserFollowSummaryEntity(f.follower));

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

  async getFollowing(
    userId: number,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<UserFollowSummaryEntity>> {
    const { page = 1, skip = 0, take = 10 } = pagination || {};
    const [totalItems, follows] = await Promise.all([
      this.prisma.userFollow.count({
        where: {
          followerId: userId,
          following: {
            deletedAt: null,
          },
        },
      }),
      this.prisma.userFollow.findMany({
        where: {
          followerId: userId,
          following: {
            deletedAt: null,
          },
        },
        select: {
          following: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              bio: true,
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = follows.map((f) => new UserFollowSummaryEntity(f.following));

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
