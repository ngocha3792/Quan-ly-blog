/// <reference types="multer" />

import { Test, TestingModule } from '@nestjs/testing';

import { CloudinaryService, MediaService, PrismaService } from '@app/core';

import { BlogownerPostHelperService } from './blogowner-post-helper.service';

describe('BlogownerPostHelperService', () => {
  let service: BlogownerPostHelperService;

  const mockPrismaService = {
    post: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockMediaService = {
    uploadMedia: jest.fn(),
    deleteMedia: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const createFile = (originalname: string): Express.Multer.File =>
    ({
      fieldname: 'media',
      originalname,
      encoding: '7bit',
      mimetype: 'image/png',
      size: 10,
      buffer: Buffer.from(originalname),
    }) as Express.Multer.File;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogownerPostHelperService,

        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },

        {
          provide: MediaService,
          useValue: mockMediaService,
        },

        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
      ],
    }).compile();

    service = module.get<BlogownerPostHelperService>(
      BlogownerPostHelperService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadMediaFiles', () => {
    it('should do nothing when files are undefined', async () => {
      await service.uploadMediaFiles(10, undefined);

      expect(mockMediaService.uploadMedia).not.toHaveBeenCalled();

      expect(mockMediaService.deleteMedia).not.toHaveBeenCalled();
    });

    it('should do nothing when files are empty', async () => {
      await service.uploadMediaFiles(10, []);

      expect(mockMediaService.uploadMedia).not.toHaveBeenCalled();

      expect(mockMediaService.deleteMedia).not.toHaveBeenCalled();
    });

    it('should upload all media files successfully without rollback', async () => {
      const file1 = createFile('media-1.png');
      const file2 = createFile('media-2.png');
      const file3 = createFile('media-3.png');

      mockMediaService.uploadMedia
        .mockResolvedValueOnce({
          id: 101,
        })
        .mockResolvedValueOnce({
          id: 102,
        })
        .mockResolvedValueOnce({
          id: 103,
        });

      await service.uploadMediaFiles(10, [file1, file2, file3]);

      expect(mockMediaService.uploadMedia).toHaveBeenNthCalledWith(
        1,
        10,
        file1,
      );

      expect(mockMediaService.uploadMedia).toHaveBeenNthCalledWith(
        2,
        10,
        file2,
      );

      expect(mockMediaService.uploadMedia).toHaveBeenNthCalledWith(
        3,
        10,
        file3,
      );

      expect(mockMediaService.deleteMedia).not.toHaveBeenCalled();
    });

    it('should rollback previously uploaded media when a later upload fails', async () => {
      const file1 = createFile('media-1.png');
      const file2 = createFile('media-2.png');
      const file3 = createFile('media-3.png');

      const uploadError = new Error('Upload media 3 failed');

      mockMediaService.uploadMedia
        .mockResolvedValueOnce({
          id: 101,
        })
        .mockResolvedValueOnce({
          id: 102,
        })
        .mockRejectedValueOnce(uploadError);

      mockMediaService.deleteMedia.mockResolvedValue({
        deleted: true,
      });

      await expect(
        service.uploadMediaFiles(10, [file1, file2, file3]),
      ).rejects.toBe(uploadError);

      expect(mockMediaService.uploadMedia).toHaveBeenCalledTimes(3);

      /**
       * Rollback theo thứ tự ngược lại:
       * media 102 trước, rồi media 101.
       */
      expect(mockMediaService.deleteMedia).toHaveBeenNthCalledWith(1, 102);

      expect(mockMediaService.deleteMedia).toHaveBeenNthCalledWith(2, 101);
    });

    it('should rollback the first uploaded media when the second upload fails', async () => {
      const file1 = createFile('media-1.png');
      const file2 = createFile('media-2.png');

      const uploadError = new Error('Upload media 2 failed');

      mockMediaService.uploadMedia
        .mockResolvedValueOnce({
          id: 101,
        })
        .mockRejectedValueOnce(uploadError);

      mockMediaService.deleteMedia.mockResolvedValue({
        deleted: true,
      });

      await expect(service.uploadMediaFiles(10, [file1, file2])).rejects.toBe(
        uploadError,
      );

      expect(mockMediaService.deleteMedia).toHaveBeenCalledTimes(1);

      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(101);
    });

    it('should continue rollback when deleting one uploaded media fails and preserve the original upload error', async () => {
      const file1 = createFile('media-1.png');
      const file2 = createFile('media-2.png');
      const file3 = createFile('media-3.png');

      const uploadError = new Error('Original upload error');

      mockMediaService.uploadMedia
        .mockResolvedValueOnce({
          id: 101,
        })
        .mockResolvedValueOnce({
          id: 102,
        })
        .mockRejectedValueOnce(uploadError);

      /**
       * Rollback 102 bị lỗi nhưng service vẫn phải
       * tiếp tục rollback 101.
       */
      mockMediaService.deleteMedia
        .mockRejectedValueOnce(new Error('Delete media 102 failed'))
        .mockResolvedValueOnce({
          deleted: true,
        });

      await expect(
        service.uploadMediaFiles(10, [file1, file2, file3]),
      ).rejects.toBe(uploadError);

      expect(mockMediaService.deleteMedia).toHaveBeenCalledTimes(2);

      expect(mockMediaService.deleteMedia).toHaveBeenNthCalledWith(1, 102);

      expect(mockMediaService.deleteMedia).toHaveBeenNthCalledWith(2, 101);
    });
  });
});
