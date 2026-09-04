import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';

import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  SelfActionNotAllowedException,
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
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!followingUser) {
      throw new UserNotFoundException(followingId.toString());
    }

    const where = {
      followerId_followingId: {
        followerId,
        followingId,
      },
    };

    try {
      return await this.prisma.userFollow.upsert({
        where,
        update: {},
        create: {
          followerId,
          followingId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingFollow = await this.prisma.userFollow.findUnique({
          where,
        });

        if (existingFollow) {
          return existingFollow;
        }
      }

      throw error;
    }
  }

  async unfollowUser(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new SelfActionNotAllowedException('unfollow');
    }

    await this.prisma.userFollow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });

    return {
      message: 'Đã bỏ follow thành công',
    };
  }

  async getFollowerCount(userId: number): Promise<number> {
    return this.prisma.userFollow.count({
      where: {
        followingId: userId,
        follower: {
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
      },
    });
  }

  async getFollowingCount(userId: number): Promise<number> {
    return this.prisma.userFollow.count({
      where: {
        followerId: userId,
        following: {
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
      },
    });
  }

  async getFollowers(
    userId: number,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<UserFollowSummaryEntity>> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        status: UserStatus.ACTIVE,
      },
    });

    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    const { page = 1, skip = 0, take = 10 } = pagination || {};
    const [totalItems, follows] = await Promise.all([
      this.prisma.userFollow.count({
        where: {
          followingId: userId,
          follower: {
            deletedAt: null,
            status: UserStatus.ACTIVE,
          },
        },
      }),
      this.prisma.userFollow.findMany({
        where: {
          followingId: userId,
          follower: {
            deletedAt: null,
            status: UserStatus.ACTIVE,
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
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        status: UserStatus.ACTIVE,
      },
    });

    if (!user) {
      throw new UserNotFoundException(userId.toString());
    }

    const { page = 1, skip = 0, take = 10 } = pagination || {};
    const [totalItems, follows] = await Promise.all([
      this.prisma.userFollow.count({
        where: {
          followerId: userId,
          following: {
            deletedAt: null,
            status: UserStatus.ACTIVE,
          },
        },
      }),
      this.prisma.userFollow.findMany({
        where: {
          followerId: userId,
          following: {
            deletedAt: null,
            status: UserStatus.ACTIVE,
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
