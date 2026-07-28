import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  UsersService,
  UserNotFoundException,
  CloudinaryService,
} from '@app/core';
import { UserProfileService } from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let usersService: {
    findById: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let cloudinaryService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    cloudinaryService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: CloudinaryService,
          useValue: cloudinaryService,
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile if user exists', async () => {
      const mockUser = { id: 1, username: 'testuser' };
      usersService.findById.mockResolvedValueOnce(mockUser);

      const result = await service.getProfile(1);

      expect(usersService.findById).toHaveBeenCalledWith(1, {
        following: { include: { follower: true } },
      });
      expect(result.id).toBe(1);
    });

    it('should throw UserNotFoundException if user does not exist', async () => {
      usersService.findById.mockResolvedValueOnce(null);

      await expect(service.getProfile(999)).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update user and return profile', async () => {
      const mockUpdatedUser = { id: 1, username: 'newname', bio: 'new bio' };
      usersService.update.mockResolvedValueOnce(mockUpdatedUser);

      const result = await service.updateProfile(1, { bio: 'new bio' } as any);

      expect(usersService.update).toHaveBeenCalledWith(1, { bio: 'new bio' });
      expect(result.bio).toBe('new bio');
    });
  });

  describe('removeProfile', () => {
    it('should remove user and return profile', async () => {
      const mockRemovedUser = { id: 1, username: 'deleted' };
      usersService.remove.mockResolvedValueOnce(mockRemovedUser);

      const result = await service.removeProfile(1);

      expect(usersService.remove).toHaveBeenCalledWith(1);
      expect(result.username).toBe('deleted');
    });
  });

  describe('uploadAvatar', () => {
    const mockFile = {
      buffer: Buffer.from('test'),
      mimetype: 'image/png',
      originalname: 'test.png',
    } as Express.Multer.File;

    it('should throw UserNotFoundException if user not found', async () => {
      usersService.findById.mockResolvedValueOnce(null);

      await expect(service.uploadAvatar(1, mockFile)).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('should throw BadRequestException if file is missing', async () => {
      usersService.findById.mockResolvedValueOnce({ id: 1 });

      await expect(service.uploadAvatar(1, undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if file is not an image', async () => {
      usersService.findById.mockResolvedValueOnce({ id: 1 });
      const notImage = { mimetype: 'text/plain' } as Express.Multer.File;

      await expect(service.uploadAvatar(1, notImage)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should upload image to cloudinary and update user avatarUrl', async () => {
      usersService.findById.mockResolvedValueOnce({
        id: 1,
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1234/old_avatar.jpg',
      });
      cloudinaryService.uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v5678/new_avatar.jpg',
      });
      usersService.update.mockResolvedValueOnce({
        id: 1,
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v5678/new_avatar.jpg',
      });

      const result = await service.uploadAvatar(1, mockFile);

      expect(cloudinaryService.deleteFile).toHaveBeenCalledWith('old_avatar', 'image');
      expect(cloudinaryService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        'nestjs_blog/users/1/avatar',
      );
      expect(usersService.update).toHaveBeenCalledWith(1, {
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v5678/new_avatar.jpg',
      });
      expect(result.avatarUrl).toBe(
        'https://res.cloudinary.com/demo/image/upload/v5678/new_avatar.jpg',
      );
    });
  });
});
