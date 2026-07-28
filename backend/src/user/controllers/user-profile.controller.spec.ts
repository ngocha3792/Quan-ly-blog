import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '@app/core';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from '../services/user-profile.service';

describe('UserProfileController', () => {
  let controller: UserProfileController;
  let userProfileService: {
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
    removeProfile: jest.Mock;
    uploadAvatar: jest.Mock;
  };

  beforeEach(async () => {
    userProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      removeProfile: jest.fn(),
      uploadAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserProfileController],
      providers: [
        {
          provide: UserProfileService,
          useValue: userProfileService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<UserProfileController>(UserProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should call service getProfile', async () => {
      userProfileService.getProfile.mockResolvedValueOnce({ id: 1 });
      const result = await controller.getProfile({ id: 1 } as any);
      expect(userProfileService.getProfile).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
    });
  });

  describe('updateProfile', () => {
    it('should call service updateProfile', async () => {
      userProfileService.updateProfile.mockResolvedValueOnce({ id: 1, bio: 'test' });
      const dto = { bio: 'test' } as any;
      const result = await controller.updateProfile({ id: 1 } as any, dto);
      expect(userProfileService.updateProfile).toHaveBeenCalledWith(1, dto);
      expect(result.bio).toBe('test');
    });
  });

  describe('removeProfile', () => {
    it('should call service removeProfile', async () => {
      userProfileService.removeProfile.mockResolvedValueOnce({ id: 1 });
      const result = await controller.removeProfile({ id: 1 } as any);
      expect(userProfileService.removeProfile).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
    });
  });

  describe('uploadAvatar', () => {
    it('should call service uploadAvatar', async () => {
      const mockFile = { originalname: 'test.png' } as any;
      userProfileService.uploadAvatar.mockResolvedValueOnce({ id: 1, avatarUrl: 'url' });
      const result = await controller.uploadAvatar({ id: 1 } as any, mockFile);
      expect(userProfileService.uploadAvatar).toHaveBeenCalledWith(1, mockFile);
      expect(result.avatarUrl).toBe('url');
    });
  });
});
