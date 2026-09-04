import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  SelfActionNotAllowedException,
  UserNotFoundException,
} from '@app/core/common/exceptions';
import { UserFollowService } from './user-follow.service';

describe('UserFollowService', () => {
  let service: UserFollowService;
  let prisma: {
    user: { findFirst: jest.Mock };
    userFollow: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
      userFollow: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserFollowService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UserFollowService>(UserFollowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('followUser', () => {
    it('should throw SelfActionNotAllowedException if followerId equals followingId', async () => {
      await expect(service.followUser(1, 1)).rejects.toThrow(
        SelfActionNotAllowedException,
      );

      expect(prisma.user.findFirst).not.toHaveBeenCalled();

      expect(prisma.userFollow.upsert).not.toHaveBeenCalled();
    });

    it('should throw UserNotFoundException if following user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(service.followUser(1, 2)).rejects.toThrow(
        UserNotFoundException,
      );

      expect(prisma.userFollow.upsert).not.toHaveBeenCalled();
    });

    it('should upsert follow relationship', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 2,
      });

      const mockFollow = {
        followerId: 1,
        followingId: 2,
        createdAt: new Date(),
      };

      prisma.userFollow.upsert.mockResolvedValueOnce(mockFollow);

      const result = await service.followUser(1, 2);

      expect(prisma.userFollow.upsert).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: 1,
            followingId: 2,
          },
        },
        update: {},
        create: {
          followerId: 1,
          followingId: 2,
        },
      });

      expect(result).toEqual(mockFollow);
    });

    it('should be idempotent when following the same user multiple times', async () => {
      const mockFollow = {
        followerId: 1,
        followingId: 2,
        createdAt: new Date(),
      };

      prisma.user.findFirst.mockResolvedValue({
        id: 2,
      });

      prisma.userFollow.upsert.mockResolvedValue(mockFollow);

      const firstResult = await service.followUser(1, 2);

      const secondResult = await service.followUser(1, 2);

      expect(firstResult).toEqual(mockFollow);
      expect(secondResult).toEqual(mockFollow);

      expect(prisma.userFollow.upsert).toHaveBeenCalledTimes(2);

      expect(prisma.userFollow.upsert).toHaveBeenNthCalledWith(1, {
        where: {
          followerId_followingId: {
            followerId: 1,
            followingId: 2,
          },
        },
        update: {},
        create: {
          followerId: 1,
          followingId: 2,
        },
      });

      expect(prisma.userFollow.upsert).toHaveBeenNthCalledWith(2, {
        where: {
          followerId_followingId: {
            followerId: 1,
            followingId: 2,
          },
        },
        update: {},
        create: {
          followerId: 1,
          followingId: 2,
        },
      });
    });

    it('should return existing follow if concurrent upsert causes P2002', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 2,
      });

      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );

      prisma.userFollow.upsert.mockRejectedValueOnce(error);

      const existingFollow = {
        followerId: 1,
        followingId: 2,
        createdAt: new Date(),
      };

      prisma.userFollow.findUnique.mockResolvedValueOnce(existingFollow);

      const result = await service.followUser(1, 2);

      expect(prisma.userFollow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: 1,
            followingId: 2,
          },
        },
      });

      expect(result).toEqual(existingFollow);
    });

    it('should rethrow P2002 if relationship cannot be found afterwards', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 2,
      });

      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );

      prisma.userFollow.upsert.mockRejectedValueOnce(error);

      prisma.userFollow.findUnique.mockResolvedValueOnce(null);

      await expect(service.followUser(1, 2)).rejects.toBe(error);
    });
  });

  describe('unfollowUser', () => {
    it('should throw SelfActionNotAllowedException if followerId equals followingId', async () => {
      await expect(service.unfollowUser(1, 1)).rejects.toThrow(
        SelfActionNotAllowedException,
      );

      expect(prisma.userFollow.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete follow relationship', async () => {
      prisma.userFollow.deleteMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.unfollowUser(1, 2);

      expect(prisma.userFollow.deleteMany).toHaveBeenCalledWith({
        where: {
          followerId: 1,
          followingId: 2,
        },
      });

      expect(result).toEqual({
        message: 'Đã bỏ follow thành công',
      });
    });

    it('should succeed even if relationship does not exist', async () => {
      prisma.userFollow.deleteMany.mockResolvedValueOnce({
        count: 0,
      });

      const result = await service.unfollowUser(1, 2);

      expect(result).toEqual({
        message: 'Đã bỏ follow thành công',
      });

      expect(prisma.userFollow.deleteMany).toHaveBeenCalledWith({
        where: {
          followerId: 1,
          followingId: 2,
        },
      });
    });
  });

  describe('getFollowerCount and getFollowingCount', () => {
    it('should return follower count', async () => {
      prisma.userFollow.count.mockResolvedValueOnce(10);
      const res = await service.getFollowerCount(1);
      expect(prisma.userFollow.count).toHaveBeenCalledWith({
        where: {
          followingId: 1,
          follower: {
            deletedAt: null,
            status: 'ACTIVE',
          },
        },
      });
      expect(res).toBe(10);
    });

    it('should return following count', async () => {
      prisma.userFollow.count.mockResolvedValueOnce(5);
      const res = await service.getFollowingCount(1);
      expect(prisma.userFollow.count).toHaveBeenCalledWith({
        where: {
          followerId: 1,
          following: {
            deletedAt: null,
            status: 'ACTIVE',
          },
        },
      });
      expect(res).toBe(5);
    });
  });

  describe('getFollowers', () => {
    it('should throw UserNotFoundException if user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getFollowers(999, { page: 1, take: 10, skip: 0 }),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('should return paginated followers mapped to UserFollowSummaryEntity', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 1 });
      prisma.userFollow.count.mockResolvedValueOnce(1);
      prisma.userFollow.findMany.mockResolvedValueOnce([
        {
          follower: {
            id: 2,
            username: 'follower1',
            avatarUrl: null,
            bio: 'test',
          },
        },
      ]);

      const result = await service.getFollowers(1, {
        page: 1,
        take: 10,
        skip: 0,
      });

      expect(prisma.userFollow.count).toHaveBeenCalled();
      expect(prisma.userFollow.findMany).toHaveBeenCalled();
      expect(result.meta.totalItems).toBe(1);
      expect(result.items[0].id).toBe(2);
      expect(result.items[0].username).toBe('follower1');
    });
  });

  describe('getFollowing', () => {
    it('should throw UserNotFoundException if user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getFollowing(999, { page: 1, take: 10, skip: 0 }),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('should return paginated following mapped to UserFollowSummaryEntity', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 1 });
      prisma.userFollow.count.mockResolvedValueOnce(1);
      prisma.userFollow.findMany.mockResolvedValueOnce([
        {
          following: {
            id: 3,
            username: 'following1',
            avatarUrl: null,
            bio: 'test',
          },
        },
      ]);

      const result = await service.getFollowing(1, {
        page: 1,
        take: 10,
        skip: 0,
      });

      expect(prisma.userFollow.count).toHaveBeenCalled();
      expect(prisma.userFollow.findMany).toHaveBeenCalled();
      expect(result.meta.totalItems).toBe(1);
      expect(result.items[0].id).toBe(3);
      expect(result.items[0].username).toBe('following1');
    });
  });
});
