import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  SelfActionNotAllowedException,
  ExistActionNotAllowedException,
  UserNotFoundException,
} from '@app/core/common/exceptions';
import { UserFollowService } from './user-follow.service';

describe('UserFollowService', () => {
  let service: UserFollowService;
  let prisma: {
    user: { findFirst: jest.Mock };
    userFollow: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
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
        create: jest.fn(),
        delete: jest.fn(),
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
    });

    it('should throw UserNotFoundException if following user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(service.followUser(1, 2)).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('should throw ExistActionNotAllowedException if already following', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 2 });
      prisma.userFollow.findUnique.mockResolvedValueOnce({
        followerId: 1,
        followingId: 2,
      });

      await expect(service.followUser(1, 2)).rejects.toThrow(
        ExistActionNotAllowedException,
      );
    });

    it('should create follow and return result if valid', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 2 });
      prisma.userFollow.findUnique.mockResolvedValueOnce(null);
      const mockFollow = { followerId: 1, followingId: 2 };
      prisma.userFollow.create.mockResolvedValueOnce(mockFollow);

      const result = await service.followUser(1, 2);

      expect(prisma.userFollow.create).toHaveBeenCalledWith({
        data: { followerId: 1, followingId: 2 },
      });
      expect(result).toEqual(mockFollow);
    });
  });

  describe('unfollowUser', () => {
    it('should throw SelfActionNotAllowedException if followerId equals followingId', async () => {
      await expect(service.unfollowUser(1, 1)).rejects.toThrow(
        SelfActionNotAllowedException,
      );
    });

    it('should throw ExistActionNotAllowedException if follow relationship does not exist', async () => {
      prisma.userFollow.findUnique.mockResolvedValueOnce(null);

      await expect(service.unfollowUser(1, 2)).rejects.toThrow(
        ExistActionNotAllowedException,
      );
    });

    it('should delete follow relationship and return success message if valid', async () => {
      prisma.userFollow.findUnique.mockResolvedValueOnce({
        followerId: 1,
        followingId: 2,
      });

      const result = await service.unfollowUser(1, 2);

      expect(prisma.userFollow.delete).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: 1,
            followingId: 2,
          },
        },
      });
      expect(result).toEqual({
        message: 'Đã bỏ follow thành công',
      });
    });
  });

  describe('getFollowerCount and getFollowingCount', () => {
    it('should return follower count', async () => {
      prisma.userFollow.count.mockResolvedValueOnce(10);
      const res = await service.getFollowerCount(1);
      expect(prisma.userFollow.count).toHaveBeenCalledWith({
        where: { followingId: 1 },
      });
      expect(res).toBe(10);
    });

    it('should return following count', async () => {
      prisma.userFollow.count.mockResolvedValueOnce(5);
      const res = await service.getFollowingCount(1);
      expect(prisma.userFollow.count).toHaveBeenCalledWith({
        where: { followerId: 1 },
      });
      expect(res).toBe(5);
    });
  });

  describe('getFollowers', () => {
    it('should return paginated followers mapped to UserFollowSummaryEntity', async () => {
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

      const result = await service.getFollowers(1, { page: 1, take: 10, skip: 0 });

      expect(prisma.userFollow.count).toHaveBeenCalled();
      expect(prisma.userFollow.findMany).toHaveBeenCalled();
      expect(result.meta.totalItems).toBe(1);
      expect(result.items[0].id).toBe(2);
      expect(result.items[0].username).toBe('follower1');
    });
  });

  describe('getFollowing', () => {
    it('should return paginated following mapped to UserFollowSummaryEntity', async () => {
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

      const result = await service.getFollowing(1, { page: 1, take: 10, skip: 0 });

      expect(prisma.userFollow.count).toHaveBeenCalled();
      expect(prisma.userFollow.findMany).toHaveBeenCalled();
      expect(result.meta.totalItems).toBe(1);
      expect(result.items[0].id).toBe(3);
      expect(result.items[0].username).toBe('following1');
    });
  });
});
