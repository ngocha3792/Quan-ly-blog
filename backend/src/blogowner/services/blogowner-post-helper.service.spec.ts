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

  const createThumbnailFile = (
    originalname: string,
    mimetype: string,
    buffer: Buffer,
    size = buffer.length,
  ): Express.Multer.File =>
    ({
      fieldname: 'thumbnail',
      originalname,
      encoding: '7bit',
      mimetype,
      size,
      buffer,
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



  describe('uploadThumbnail', () => {
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);

    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
      0x00,
    ]);

    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46,
      0x04, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]);

    it.each([
      ['cover.jpg', 'image/jpeg', jpegBuffer],
      ['cover.jpeg', 'image/jpeg', jpegBuffer],
      ['cover.png', 'image/png', pngBuffer],
      ['cover.webp', 'image/webp', webpBuffer],
    ])(
      'should accept a real supported thumbnail: %s',
      async (originalname, mimetype, buffer) => {
        const file = createThumbnailFile(
          originalname,
          mimetype,
          buffer,
        );

        mockCloudinaryService.uploadFile.mockResolvedValue({
          secure_url: 'https://example.com/cover',
          public_id: 'cover',
        });

        await service.uploadThumbnail(10, file);

        expect(mockCloudinaryService.uploadFile).toHaveBeenCalledWith(
          file,
          'nestjs_blog/posts/10/thumbnail',
        );
      },
    );

    it('should reject HTML disguised as image/png', async () => {
      const file = createThumbnailFile(
        'fake.png',
        'image/png',
        Buffer.from('<html><script>alert(1)</script></html>'),
      );

      await expect(service.uploadThumbnail(10, file)).rejects.toThrow(
        'Ảnh bìa chỉ hỗ trợ file JPEG, PNG hoặc WEBP hợp lệ.',
      );

      expect(mockCloudinaryService.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject SVG thumbnails', async () => {
      const file = createThumbnailFile(
        'vector.svg',
        'image/svg+xml',
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      );

      await expect(service.uploadThumbnail(10, file)).rejects.toThrow(
        'Ảnh bìa chỉ hỗ trợ file JPEG, PNG hoặc WEBP hợp lệ.',
      );

      expect(mockCloudinaryService.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject MIME that does not match real file bytes', async () => {
      const file = createThumbnailFile(
        'cover.png',
        'image/png',
        jpegBuffer,
      );

      await expect(service.uploadThumbnail(10, file)).rejects.toThrow(
        'MIME type của ảnh bìa không khớp với nội dung file thực tế.',
      );

      expect(mockCloudinaryService.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject extension that does not match real file bytes', async () => {
      const file = createThumbnailFile(
        'cover.html',
        'image/jpeg',
        jpegBuffer,
      );

      await expect(service.uploadThumbnail(10, file)).rejects.toThrow(
        'Phần mở rộng ảnh bìa không khớp với định dạng file thực tế.',
      );

      expect(mockCloudinaryService.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject thumbnail larger than 10 MB', async () => {
      const file = createThumbnailFile(
        'cover.jpg',
        'image/jpeg',
        jpegBuffer,
        10 * 1024 * 1024 + 1,
      );

      await expect(service.uploadThumbnail(10, file)).rejects.toThrow(
        'Ảnh bìa không được vượt quá 10 MB.',
      );

      expect(mockCloudinaryService.uploadFile).not.toHaveBeenCalled();
    });
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
