import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '@app/core';
import { UserFollowController } from './user-follow.controller';
import { UserFollowService } from '../services/user-follow.service';

describe('UserFollowController', () => {
  let controller: UserFollowController;
  let userFollowService: {
    getFollowers: jest.Mock;
    getFollowing: jest.Mock;
    followUser: jest.Mock;
    unfollowUser: jest.Mock;
  };

  beforeEach(async () => {
    userFollowService = {
      getFollowers: jest.fn(),
      getFollowing: jest.fn(),
      followUser: jest.fn(),
      unfollowUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserFollowController],
      providers: [
        {
          provide: UserFollowService,
          useValue: userFollowService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<UserFollowController>(UserFollowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyFollowers', () => {
    it('should call getFollowers with current user ID', async () => {
      const mockResult = { items: [], meta: {} as any };
      userFollowService.getFollowers.mockResolvedValueOnce(mockResult);

      const result = await controller.getMyFollowers({ id: 1 } as any, {} as any);

      expect(userFollowService.getFollowers).toHaveBeenCalledWith(1, {});
      expect(result).toBe(mockResult);
    });
  });

  describe('getMyFollowing', () => {
    it('should call getFollowing with current user ID', async () => {
      const mockResult = { items: [], meta: {} as any };
      userFollowService.getFollowing.mockResolvedValueOnce(mockResult);

      const result = await controller.getMyFollowing({ id: 1 } as any, {} as any);

      expect(userFollowService.getFollowing).toHaveBeenCalledWith(1, {});
      expect(result).toBe(mockResult);
    });
  });

  describe('getUserFollowers', () => {
    it('should call getFollowers with target user ID', async () => {
      const mockResult = { items: [], meta: {} as any };
      userFollowService.getFollowers.mockResolvedValueOnce(mockResult);

      const result = await controller.getUserFollowers(2, {} as any);

      expect(userFollowService.getFollowers).toHaveBeenCalledWith(2, {});
      expect(result).toBe(mockResult);
    });
  });

  describe('getUserFollowing', () => {
    it('should call getFollowing with target user ID', async () => {
      const mockResult = { items: [], meta: {} as any };
      userFollowService.getFollowing.mockResolvedValueOnce(mockResult);

      const result = await controller.getUserFollowing(2, {} as any);

      expect(userFollowService.getFollowing).toHaveBeenCalledWith(2, {});
      expect(result).toBe(mockResult);
    });
  });

  describe('followUser', () => {
    it('should call followUser with current user ID and target ID', async () => {
      const mockResult = { followerId: 1, followingId: 2 };
      userFollowService.followUser.mockResolvedValueOnce(mockResult);

      const result = await controller.followUser({ id: 1 } as any, 2);

      expect(userFollowService.followUser).toHaveBeenCalledWith(1, 2);
      expect(result).toBe(mockResult);
    });
  });

  describe('unfollowUser', () => {
    it('should call unfollowUser with current user ID and target ID', async () => {
      const mockResult = { message: 'Đã bỏ follow thành công' };
      userFollowService.unfollowUser.mockResolvedValueOnce(mockResult);

      const result = await controller.unfollowUser({ id: 1 } as any, 2);

      expect(userFollowService.unfollowUser).toHaveBeenCalledWith(1, 2);
      expect(result).toBe(mockResult);
    });
  });
});
