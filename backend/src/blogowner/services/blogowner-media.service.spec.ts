/// <reference types="multer" />

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus } from '@prisma/client';

import { MediaService, PrismaService } from '@app/core';

import { BlogownerMediaService } from './blogowner-media.service';
import { BlogownerPostHelperService } from './blogowner-post-helper.service';

describe('BlogownerMediaService', () => {
  let service: BlogownerMediaService;

  const mockPrismaService = {
    media: {
      findFirst: jest.fn(),
    },
  };

  const mockMediaService = {
    uploadMedia: jest.fn(),
    deleteMedia: jest.fn(),
  };

  const mockHelper = {
    findOwnedPost: jest.fn(),
    assertEditable: jest.fn(),
    resetReviewOnEdit: jest.fn(),
  };

  const file = {
    fieldname: 'file',
    originalname: 'image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 10,
    buffer: Buffer.from('fake-image'),
  } as Express.Multer.File;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogownerMediaService,

        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },

        {
          provide: MediaService,
          useValue: mockMediaService,
        },

        {
          provide: BlogownerPostHelperService,
          useValue: mockHelper,
        },
      ],
    }).compile();

    service = module.get<BlogownerMediaService>(BlogownerMediaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should reset review before uploading media for a published post', async () => {
      mockHelper.findOwnedPost.mockResolvedValue({
        id: 10,
        authorId: 3,
        status: PostStatus.PUBLISH,
      });

      mockHelper.resetReviewOnEdit.mockResolvedValue(undefined);

      mockMediaService.uploadMedia.mockResolvedValue({
        id: 100,
        postId: 10,
        url: 'https://example.com/image.png',
      });

      const result = await service.upload(3, 10, file);

      expect(mockHelper.findOwnedPost).toHaveBeenCalledWith(3, 10);

      expect(mockHelper.assertEditable).toHaveBeenCalledWith(
        PostStatus.PUBLISH,
      );

      expect(mockHelper.resetReviewOnEdit).toHaveBeenCalledTimes(1);

      expect(mockHelper.resetReviewOnEdit).toHaveBeenCalledWith(
        10,
        PostStatus.PUBLISH,
      );

      expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(10, file);

      expect(
        mockHelper.resetReviewOnEdit.mock.invocationCallOrder[0],
      ).toBeLessThan(mockMediaService.uploadMedia.mock.invocationCallOrder[0]);

      expect(result).toEqual({
        id: 100,
        postId: 10,
        url: 'https://example.com/image.png',
      });
    });

    it('should not upload media when resetting a published post fails', async () => {
      mockHelper.findOwnedPost.mockResolvedValue({
        id: 10,
        authorId: 3,
        status: PostStatus.PUBLISH,
      });

      mockHelper.resetReviewOnEdit.mockRejectedValue(
        new Error('Reset review failed'),
      );

      await expect(service.upload(3, 10, file)).rejects.toThrow(
        'Reset review failed',
      );

      expect(mockMediaService.uploadMedia).not.toHaveBeenCalled();
    });

    it('should keep a rejected post rejected when media upload fails', async () => {
      mockHelper.findOwnedPost.mockResolvedValue({
        id: 10,
        authorId: 3,
        status: PostStatus.REJECT,
      });

      mockMediaService.uploadMedia.mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(service.upload(3, 10, file)).rejects.toThrow(
        'Upload failed',
      );

      expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(10, file);

      expect(mockHelper.resetReviewOnEdit).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should reset review before deleting media for a published post', async () => {
      mockHelper.findOwnedPost.mockResolvedValue({
        id: 10,
        authorId: 3,
        status: PostStatus.PUBLISH,
      });

      mockPrismaService.media.findFirst.mockResolvedValue({
        id: 100,
      });

      mockHelper.resetReviewOnEdit.mockResolvedValue(undefined);

      mockMediaService.deleteMedia.mockResolvedValue({
        id: 100,
      });

      const result = await service.remove(3, 10, 100);

      expect(mockPrismaService.media.findFirst).toHaveBeenCalledWith({
        where: {
          id: 100,
          postId: 10,
          deletedAt: null,
        },

        select: {
          id: true,
        },
      });

      expect(mockHelper.resetReviewOnEdit).toHaveBeenCalledTimes(1);

      expect(mockHelper.resetReviewOnEdit).toHaveBeenCalledWith(
        10,
        PostStatus.PUBLISH,
      );

      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(100);

      expect(
        mockHelper.resetReviewOnEdit.mock.invocationCallOrder[0],
      ).toBeLessThan(mockMediaService.deleteMedia.mock.invocationCallOrder[0]);

      expect(result).toEqual({
        id: 100,
      });
    });

    it('should not delete media when resetting a published post fails', async () => {
      mockHelper.findOwnedPost.mockResolvedValue({
        id: 10,
        authorId: 3,
        status: PostStatus.PUBLISH,
      });

      mockPrismaService.media.findFirst.mockResolvedValue({
        id: 100,
      });

      mockHelper.resetReviewOnEdit.mockRejectedValue(
        new Error('Reset review failed'),
      );

      await expect(service.remove(3, 10, 100)).rejects.toThrow(
        'Reset review failed',
      );

      expect(mockMediaService.deleteMedia).not.toHaveBeenCalled();
    });

    it('should keep a rejected post rejected when media deletion fails', async () => {
      mockHelper.findOwnedPost.mockResolvedValue({
        id: 10,
        authorId: 3,
        status: PostStatus.REJECT,
      });

      mockPrismaService.media.findFirst.mockResolvedValue({
        id: 100,
      });

      mockMediaService.deleteMedia.mockRejectedValue(
        new Error('Delete failed'),
      );

      await expect(service.remove(3, 10, 100)).rejects.toThrow('Delete failed');

      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(100);

      expect(mockHelper.resetReviewOnEdit).not.toHaveBeenCalled();
    });

    it('should throw when media does not belong to the post', async () => {
      mockHelper.findOwnedPost.mockResolvedValue({
        id: 10,
        authorId: 3,
        status: PostStatus.DRAFT,
      });

      mockPrismaService.media.findFirst.mockResolvedValue(null);

      await expect(service.remove(3, 10, 999)).rejects.toThrow(
        new NotFoundException('Media không tồn tại trong bài viết này'),
      );

      expect(mockMediaService.deleteMedia).not.toHaveBeenCalled();

      expect(mockHelper.resetReviewOnEdit).not.toHaveBeenCalled();
    });
  });
});
