import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  SelfActionNotAllowedException,
  ExistActionNotAllowedException,
  UserNotFoundException,
} from '@app/core/common/exceptions';
import type { PaginationParams } from '@app/core';
import { UserProfileEntity } from '../entities';

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

    return { success: true, message: 'Đã bỏ follow thành công' };
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

  async getFollowers(userId: number, pagination?: PaginationParams) {
    const { page = 1, skip = 0, take = 10 } = pagination || {};
    const [total, follows] = await Promise.all([
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
        include: {
          follower: true,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      take,
      data: follows.map((f) => new UserProfileEntity(f.follower)),
    };
  }

  async getFollowing(userId: number, pagination?: PaginationParams) {
    const { page = 1, skip = 0, take = 10 } = pagination || {};
    const [total, follows] = await Promise.all([
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
        include: {
          following: true,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      take,
      data: follows.map((f) => new UserProfileEntity(f.following)),
    };
  }
}
