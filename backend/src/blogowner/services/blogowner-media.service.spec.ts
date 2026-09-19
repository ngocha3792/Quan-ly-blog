/// <reference types="multer" />

import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus } from '@prisma/client';

import { CloudinaryService, MediaService, PrismaService } from '@app/core';

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
    findOwnedPostGroup: jest.fn(),
    assertEditable: jest.fn(),
    updateOwnedPostGroupStatus: jest.fn(),
    validateContentImageFile: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
  };

  const file = {
    fieldname: 'file',
    originalname: 'image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 10,
    buffer: Buffer.from('fake-image'),
  } as Express.Multer.File;

  const createGroup = (
    status: PostStatus,
  ) => {
    const root = {
      id: 10,
      authorId: 3,
      parentPostId: null,
      status,
    };

    const translation = {
      id: 11,
      authorId: 3,
      parentPostId: 10,
      status,
    };

    return {
      rootPostId: 10,
      root,
      translations: [translation],
      posts: [root, translation],
    };
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
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
            provide:
              BlogownerPostHelperService,
            useValue: mockHelper,
          },

          {
            provide: CloudinaryService,
            useValue: mockCloudinaryService,
          },
        ],
      }).compile();

    service =
      module.get<BlogownerMediaService>(
        BlogownerMediaService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should upload media to the root post and keep a draft group unchanged', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.DRAFT),
      );

      mockMediaService.uploadMedia.mockResolvedValue({
        id: 100,
        postId: 10,
        url: 'https://example.com/image.png',
      });

      const result =
        await service.upload(
          3,
          10,
          file,
        );

      expect(
        mockHelper.findOwnedPostGroup,
      ).toHaveBeenCalledWith(3, 10);

      expect(
        mockHelper.assertEditable,
      ).toHaveBeenCalledTimes(2);

      expect(
        mockMediaService.uploadMedia,
      ).toHaveBeenCalledWith(
        10,
        file,
      );

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).not.toHaveBeenCalled();

      expect(result).toEqual({
        id: 100,
        postId: 10,
        url: 'https://example.com/image.png',
      });
    });

    it('should reject standalone media upload by translation id', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.DRAFT),
      );

      await expect(
        service.upload(
          3,
          11,
          file,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Chỉ được thay đổi media của bài gốc. Các bản dịch thuộc cùng một nhóm bài viết.',
        ),
      );

      expect(
        mockMediaService.uploadMedia,
      ).not.toHaveBeenCalled();

      expect(
        mockHelper.assertEditable,
      ).not.toHaveBeenCalled();
    });

    it('should reject media upload when any group post is pending review', async () => {
      const group =
        createGroup(PostStatus.DRAFT);

      group.translations[0].status =
        PostStatus.PENDING_REVIEW;
      group.posts[1].status =
        PostStatus.PENDING_REVIEW;

      mockHelper.findOwnedPostGroup.mockResolvedValue(
        group,
      );

      mockHelper.assertEditable.mockImplementation(
        (status: PostStatus) => {
          if (
            status ===
            PostStatus.PENDING_REVIEW
          ) {
            throw new BadRequestException(
              'Bài viết đang chờ Moderator duyệt nên không thể chỉnh sửa.',
            );
          }
        },
      );

      await expect(
        service.upload(
          3,
          10,
          file,
        ),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        mockMediaService.uploadMedia,
      ).not.toHaveBeenCalled();
    });

    it('should move the whole published group to pending review before uploading', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.PUBLISH),
      );

      mockHelper.updateOwnedPostGroupStatus.mockResolvedValue(
        undefined,
      );

      mockMediaService.uploadMedia.mockResolvedValue({
        id: 100,
        postId: 10,
        url: 'https://example.com/image.png',
      });

      const result =
        await service.upload(
          3,
          10,
          file,
        );

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).toHaveBeenCalledTimes(1);

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).toHaveBeenCalledWith(
        3,
        10,
        PostStatus.PENDING_REVIEW,
      );

      expect(
        mockHelper.updateOwnedPostGroupStatus
          .mock.invocationCallOrder[0],
      ).toBeLessThan(
        mockMediaService.uploadMedia
          .mock.invocationCallOrder[0],
      );

      expect(result).toEqual({
        id: 100,
        postId: 10,
        url: 'https://example.com/image.png',
      });
    });

    it('should not upload when resetting a published group fails', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.PUBLISH),
      );

      mockHelper.updateOwnedPostGroupStatus.mockRejectedValue(
        new Error('Reset group failed'),
      );

      await expect(
        service.upload(
          3,
          10,
          file,
        ),
      ).rejects.toThrow(
        'Reset group failed',
      );

      expect(
        mockMediaService.uploadMedia,
      ).not.toHaveBeenCalled();
    });

    it('should keep a rejected group rejected when upload fails', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.REJECT),
      );

      mockMediaService.uploadMedia.mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(
        service.upload(
          3,
          10,
          file,
        ),
      ).rejects.toThrow(
        'Upload failed',
      );

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).not.toHaveBeenCalled();
    });

    it('should move the whole rejected group to draft after successful upload', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.REJECT),
      );

      mockMediaService.uploadMedia.mockResolvedValue({
        id: 100,
        postId: 10,
      });

      mockHelper.updateOwnedPostGroupStatus.mockResolvedValue(
        undefined,
      );

      await service.upload(
        3,
        10,
        file,
      );

      expect(
        mockMediaService.uploadMedia,
      ).toHaveBeenCalledWith(
        10,
        file,
      );

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).toHaveBeenCalledWith(
        3,
        10,
        PostStatus.DRAFT,
      );

      expect(
        mockMediaService.uploadMedia
          .mock.invocationCallOrder[0],
      ).toBeLessThan(
        mockHelper.updateOwnedPostGroupStatus
          .mock.invocationCallOrder[0],
      );
    });
  });

  describe('uploadContentImage', () => {
    it('should validate, upload to Cloudinary and return the secure url', async () => {
      mockCloudinaryService.uploadFile.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/content/pic.png',
      });

      const result = await service.uploadContentImage(file);

      expect(
        mockHelper.validateContentImageFile,
      ).toHaveBeenCalledWith(file);

      expect(
        mockCloudinaryService.uploadFile,
      ).toHaveBeenCalledWith(
        file,
        'nestjs_blog/posts/content',
      );

      expect(result).toEqual({
        url: 'https://res.cloudinary.com/demo/image/upload/v1/content/pic.png',
      });
    });

    it('should not call Cloudinary when validation fails', async () => {
      mockHelper.validateContentImageFile.mockImplementation(() => {
        throw new BadRequestException('Ảnh nội dung không được vượt quá 10 MB.');
      });

      await expect(
        service.uploadContentImage(file),
      ).rejects.toThrow(
        'Ảnh nội dung không được vượt quá 10 MB.',
      );

      expect(
        mockCloudinaryService.uploadFile,
      ).not.toHaveBeenCalled();
    });

    it('should wrap a Cloudinary failure in BadRequestException', async () => {
      mockCloudinaryService.uploadFile.mockRejectedValue(
        new Error('Cloudinary timeout'),
      );

      await expect(
        service.uploadContentImage(file),
      ).rejects.toThrow(
        new BadRequestException(
          'Lỗi khi upload ảnh nội dung: Cloudinary timeout',
        ),
      );
    });
  });

  describe('remove', () => {
    it('should delete media from the root post and keep a draft group unchanged', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.DRAFT),
      );

      mockPrismaService.media.findFirst.mockResolvedValue({
        id: 100,
      });

      mockMediaService.deleteMedia.mockResolvedValue({
        id: 100,
      });

      const result =
        await service.remove(
          3,
          10,
          100,
        );

      expect(
        mockPrismaService.media.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 100,
          postId: 10,
          deletedAt: null,
        },

        select: {
          id: true,
        },
      });

      expect(
        mockMediaService.deleteMedia,
      ).toHaveBeenCalledWith(100);

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).not.toHaveBeenCalled();

      expect(result).toEqual({
        id: 100,
      });
    });

    it('should reject standalone media deletion by translation id', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.DRAFT),
      );

      await expect(
        service.remove(
          3,
          11,
          100,
        ),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        mockPrismaService.media.findFirst,
      ).not.toHaveBeenCalled();

      expect(
        mockMediaService.deleteMedia,
      ).not.toHaveBeenCalled();
    });

    it('should throw when media does not belong to the root post', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.DRAFT),
      );

      mockPrismaService.media.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.remove(
          3,
          10,
          999,
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'Media không tồn tại trong bài viết này',
        ),
      );

      expect(
        mockMediaService.deleteMedia,
      ).not.toHaveBeenCalled();

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).not.toHaveBeenCalled();
    });

    it('should move the whole published group to pending review before deleting media', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.PUBLISH),
      );

      mockPrismaService.media.findFirst.mockResolvedValue({
        id: 100,
      });

      mockHelper.updateOwnedPostGroupStatus.mockResolvedValue(
        undefined,
      );

      mockMediaService.deleteMedia.mockResolvedValue({
        id: 100,
      });

      const result =
        await service.remove(
          3,
          10,
          100,
        );

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).toHaveBeenCalledWith(
        3,
        10,
        PostStatus.PENDING_REVIEW,
      );

      expect(
        mockHelper.updateOwnedPostGroupStatus
          .mock.invocationCallOrder[0],
      ).toBeLessThan(
        mockMediaService.deleteMedia
          .mock.invocationCallOrder[0],
      );

      expect(result).toEqual({
        id: 100,
      });
    });

    it('should not delete when resetting a published group fails', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.PUBLISH),
      );

      mockPrismaService.media.findFirst.mockResolvedValue({
        id: 100,
      });

      mockHelper.updateOwnedPostGroupStatus.mockRejectedValue(
        new Error('Reset group failed'),
      );

      await expect(
        service.remove(
          3,
          10,
          100,
        ),
      ).rejects.toThrow(
        'Reset group failed',
      );

      expect(
        mockMediaService.deleteMedia,
      ).not.toHaveBeenCalled();
    });

    it('should keep a rejected group rejected when media deletion fails', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.REJECT),
      );

      mockPrismaService.media.findFirst.mockResolvedValue({
        id: 100,
      });

      mockMediaService.deleteMedia.mockRejectedValue(
        new Error('Delete failed'),
      );

      await expect(
        service.remove(
          3,
          10,
          100,
        ),
      ).rejects.toThrow(
        'Delete failed',
      );

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).not.toHaveBeenCalled();
    });

    it('should move the whole rejected group to draft after successful deletion', async () => {
      mockHelper.findOwnedPostGroup.mockResolvedValue(
        createGroup(PostStatus.REJECT),
      );

      mockPrismaService.media.findFirst.mockResolvedValue({
        id: 100,
      });

      mockMediaService.deleteMedia.mockResolvedValue({
        id: 100,
      });

      mockHelper.updateOwnedPostGroupStatus.mockResolvedValue(
        undefined,
      );

      await service.remove(
        3,
        10,
        100,
      );

      expect(
        mockHelper.updateOwnedPostGroupStatus,
      ).toHaveBeenCalledWith(
        3,
        10,
        PostStatus.DRAFT,
      );

      expect(
        mockMediaService.deleteMedia
          .mock.invocationCallOrder[0],
      ).toBeLessThan(
        mockHelper.updateOwnedPostGroupStatus
          .mock.invocationCallOrder[0],
      );
    });
  });
});
