import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  UsersService,
  UserNotFoundException,
  CloudinaryService,
} from '@app/core';
import { UserProfileService } from './user-profile.service';

const createPngFile = (mimetype = 'image/png'): Express.Multer.File =>
  ({
    buffer: Buffer.from([
      // PNG magic bytes
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,

      // Dummy content
      0x00, 0x00, 0x00, 0x00,
    ]),

    mimetype,

    originalname: 'avatar.png',

    size: 12,
  }) as Express.Multer.File;

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
        following: {
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
        },
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
    it('should update user and return profile when no file provided', async () => {
      const mockUpdatedUser = { id: 1, username: 'newname', bio: 'new bio' };
      usersService.update.mockResolvedValueOnce(mockUpdatedUser);

      const result = await service.updateProfile(1, { bio: 'new bio' });

      expect(usersService.update).toHaveBeenCalledWith(1, { bio: 'new bio' });
      expect(result.bio).toBe('new bio');
    });

    it('should reject a fake image even when client sends image/png mimetype', async () => {
      usersService.findById.mockResolvedValueOnce({
        id: 1,
        avatarUrl: null,
        avatarPublicId: null,
      });

      const fakeImage = {
        buffer: Buffer.from('<script>alert(1)</script>'),
        mimetype: 'image/png',
        originalname: 'evil.png',
        size: 25,
      } as Express.Multer.File;

      await expect(service.uploadAvatar(1, fakeImage)).rejects.toThrow(
        BadRequestException,
      );

      expect(cloudinaryService.uploadFile).not.toHaveBeenCalled();
    });

    it('should validate actual file bytes instead of trusting mimetype', async () => {
      const realPng = createPngFile('application/octet-stream');

      usersService.findById.mockResolvedValueOnce({
        id: 1,
        avatarUrl: null,
        avatarPublicId: null,
      });

      cloudinaryService.uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v123/new.png',
        public_id: 'nestjs_blog/users/1/avatar/new',
      } as any);

      usersService.update.mockResolvedValueOnce({
        id: 1,
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v123/new.png',
        avatarPublicId: 'nestjs_blog/users/1/avatar/new',
      });

      await expect(service.uploadAvatar(1, realPng)).resolves.toBeDefined();

      expect(cloudinaryService.uploadFile).toHaveBeenCalled();
    });

    it('should store cloudinary publicId together with avatarUrl', async () => {
      const file = createPngFile();

      usersService.findById.mockResolvedValueOnce({
        id: 1,
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/old.jpg',
        avatarPublicId: 'nestjs_blog/users/1/avatar/old',
      });

      cloudinaryService.uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v2/new.jpg',
        public_id: 'nestjs_blog/users/1/avatar/new',
      } as any);

      usersService.update.mockResolvedValueOnce({
        id: 1,
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v2/new.jpg',
        avatarPublicId: 'nestjs_blog/users/1/avatar/new',
      });

      const result = await service.uploadAvatar(1, file);

      expect(usersService.update).toHaveBeenCalledWith(1, {
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v2/new.jpg',
        avatarPublicId: 'nestjs_blog/users/1/avatar/new',
      });

      expect(cloudinaryService.deleteFile).toHaveBeenCalledWith(
        'nestjs_blog/users/1/avatar/old',
        'image',
      );

      expect(result.avatarUrl).toBe(
        'https://res.cloudinary.com/demo/image/upload/v2/new.jpg',
      );
    });

    it('should cleanup newly uploaded avatar when database update fails', async () => {
      const file = createPngFile();

      usersService.findById.mockResolvedValueOnce({
        id: 1,
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/old.jpg',
        avatarPublicId: 'nestjs_blog/users/1/avatar/old',
      });

      cloudinaryService.uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v2/new.jpg',
        public_id: 'nestjs_blog/users/1/avatar/new',
      } as any);

      usersService.update.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.uploadAvatar(1, file)).rejects.toThrow(
        'Database error',
      );

      expect(cloudinaryService.deleteFile).toHaveBeenCalledWith(
        'nestjs_blog/users/1/avatar/new',
        'image',
      );

      expect(cloudinaryService.deleteFile).not.toHaveBeenCalledWith(
        'nestjs_blog/users/1/avatar/old',
        'image',
      );
    });

    it('should update database before deleting the old avatar', async () => {
      const file = createPngFile();

      usersService.findById.mockResolvedValueOnce({
        id: 1,
        avatarPublicId: 'nestjs_blog/users/1/avatar/old',
      });

      cloudinaryService.uploadFile.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v2/new.jpg',
        public_id: 'nestjs_blog/users/1/avatar/new',
      } as any);

      usersService.update.mockResolvedValueOnce({
        id: 1,
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v2/new.jpg',
        avatarPublicId: 'nestjs_blog/users/1/avatar/new',
      });

      await service.uploadAvatar(1, file);

      const updateOrder = usersService.update.mock.invocationCallOrder[0];
      const deleteOrder =
        cloudinaryService.deleteFile.mock.invocationCallOrder[0];

      expect(updateOrder).toBeLessThan(deleteOrder);
    });
  });

  describe('removeProfile', () => {
    it('should throw UserNotFoundException if user does not exist', async () => {
      usersService.findById.mockResolvedValueOnce(null);

      await expect(service.removeProfile(999)).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('should remove user, delete avatar on Cloudinary using avatarPublicId if present', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        avatarUrl:
          'https://res.cloudinary.com/demo/image/upload/v1234/user_avatar.jpg',
        avatarPublicId: 'nestjs_blog/users/1/avatar/user_avatar',
      };
      const mockRemovedUser = { id: 1, username: 'deleted' };

      usersService.findById.mockResolvedValueOnce(mockUser);
      usersService.remove.mockResolvedValueOnce(mockRemovedUser);

      const result = await service.removeProfile(1);

      expect(cloudinaryService.deleteFile).toHaveBeenCalledWith(
        'nestjs_blog/users/1/avatar/user_avatar',
        'image',
      );
      expect(usersService.remove).toHaveBeenCalledWith(1);
      expect(result.username).toBe('deleted');
    });
  });

  describe('uploadAvatar', () => {
    it('should throw BadRequestException if file is missing', async () => {
      await expect(service.uploadAvatar(1, undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
