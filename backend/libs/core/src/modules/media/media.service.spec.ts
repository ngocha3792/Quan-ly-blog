/// <reference types="jest" />

import { NotFoundException } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@app/core/core/prisma/prisma.service';

import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MediaService } from './media.service';

describe('MediaService', () => {
  let service: MediaService;

  const mockPrismaService = {
    media: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockCloudinaryService = {
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,

        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },

        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should soft delete media before deleting file from Cloudinary', async () => {
    mockPrismaService.media.findFirst.mockResolvedValue({
      id: 10,
      postId: 1,
      mediaType: MediaType.IMAGE,

      mediaUrl: 'https://res.cloudinary.com/demo/image/upload/test.png',

      publicId: 'nestjs_blog/posts/1/test',

      deletedAt: null,
    });

    mockPrismaService.media.update.mockResolvedValue({
      id: 10,
      deletedAt: new Date(),
    });

    mockCloudinaryService.deleteFile.mockResolvedValue({
      result: 'ok',
    });

    const result = await service.deleteMedia(10);

    expect(mockPrismaService.media.findFirst).toHaveBeenCalledWith({
      where: {
        id: 10,
        deletedAt: null,
      },
    });

    expect(mockPrismaService.media.update).toHaveBeenCalledWith({
      where: {
        id: 10,
      },

      data: {
        deletedAt: expect.any(Date),
      },
    });

    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'nestjs_blog/posts/1/test',
      'image',
    );

    /**
     * DB phải soft-delete trước rồi mới cleanup Cloudinary.
     */
    expect(
      mockPrismaService.media.update.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockCloudinaryService.deleteFile.mock.invocationCallOrder[0],
    );

    expect(result).toEqual({
      message: 'Đã xóa media thành công',
    });
  });

  it('should use video resource type when deleting video', async () => {
    mockPrismaService.media.findFirst.mockResolvedValue({
      id: 20,
      postId: 1,

      mediaType: MediaType.VIDEO,

      mediaUrl: 'https://res.cloudinary.com/demo/video/upload/test.mp4',

      publicId: 'nestjs_blog/posts/1/video',

      deletedAt: null,
    });

    mockPrismaService.media.update.mockResolvedValue({
      id: 20,
      deletedAt: new Date(),
    });

    mockCloudinaryService.deleteFile.mockResolvedValue({
      result: 'ok',
    });

    await service.deleteMedia(20);

    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'nestjs_blog/posts/1/video',
      'video',
    );
  });

  it('should throw not found when media is already deleted or does not exist', async () => {
    mockPrismaService.media.findFirst.mockResolvedValue(null);

    await expect(service.deleteMedia(10)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(mockPrismaService.media.update).not.toHaveBeenCalled();

    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalled();
  });

  it('should keep media soft deleted when Cloudinary cleanup fails', async () => {
    mockPrismaService.media.findFirst.mockResolvedValue({
      id: 10,
      postId: 1,

      mediaType: MediaType.IMAGE,

      mediaUrl: 'https://res.cloudinary.com/demo/image/upload/test.png',

      publicId: 'nestjs_blog/posts/1/test',

      deletedAt: null,
    });

    mockPrismaService.media.update.mockResolvedValue({
      id: 10,
      deletedAt: new Date(),
    });

    mockCloudinaryService.deleteFile.mockRejectedValue(
      new Error('Cloudinary unavailable'),
    );

    await expect(service.deleteMedia(10)).resolves.toEqual({
      message: 'Đã xóa media thành công',
    });

    expect(mockPrismaService.media.update).toHaveBeenCalled();

    expect(mockCloudinaryService.deleteFile).toHaveBeenCalled();
  });
});
