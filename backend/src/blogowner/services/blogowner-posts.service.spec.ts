import { BadRequestException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { LibreTranslateService, PostsService, PrismaService } from '@app/core';

import { BlogownerPostEntity } from '../entities';
import { BlogownerPostHelperService } from './blogowner-post-helper.service';
import { BlogownerPostsService } from './blogowner-posts.service';
import { BLOGOWNER_TRANSLATION_QUEUE_SERVICE } from '../queues/blogowner-translation.constants';
describe('BlogownerPostsService', () => {
  let service: BlogownerPostsService;

  const mockPrismaService = {
    post: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },

    language: {
      findFirst: jest.fn(),
    },

    category: {
      findMany: jest.fn(),
    },
  };

  const mockPostsService = {
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockHelper = {
    findOwnedPost: jest.fn(),
    findOwnedPostGroup: jest.fn(),
    updateOwnedPostGroupStatus: jest.fn(),
    assertEditable: jest.fn(),
    assertSubmittable: jest.fn(),
    getNextStatusOnEdit: jest.fn(),
    resetReviewOnEdit: jest.fn(),
    validateThumbnailFile: jest.fn(),
    uploadThumbnail: jest.fn(),
    uploadMediaFiles: jest.fn(),
    deleteOldThumbnail: jest.fn(),
  };

  /**
   * Chỉ dùng để mô phỏng hành vi Cloudinary
   * mà helper thực hiện trong test thumbnail.
   */
  const mockCloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockLibreTranslateService = {
    translateTexts: jest.fn(),
  };

  const mockTranslationQueueService = {
    enqueueBatch: jest.fn(),
    hasActiveBatch: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    /**
     * Mặc định không có batch dịch nào đang chạy — các test không
     * liên quan tới submitForReview()/batch không cần tự set lại.
     */
    mockTranslationQueueService.hasActiveBatch.mockResolvedValue(false);

    /**
     * Giả lập helper.uploadThumbnail()
     * gọi Cloudinary và trả kết quả upload.
     */
    mockHelper.uploadThumbnail.mockImplementation(
      (postId: number, file: Express.Multer.File) =>
        mockCloudinaryService.uploadFile(
          file,
          `nestjs_blog/posts/${postId}/thumbnail`,
        ),
    );

    /**
     * Giả lập helper.deleteOldThumbnail()
     * parse publicId từ URL Cloudinary.
     */
    mockHelper.deleteOldThumbnail.mockImplementation(
      (url: string | null | undefined) => {
        if (url && url.includes('/upload/')) {
          const parts = url.split('/upload/');

          if (parts.length > 1) {
            const path = parts[1].replace(/^v\d+\//, '');

            const dotIndex = path.lastIndexOf('.');

            const publicId = dotIndex >= 0 ? path.substring(0, dotIndex) : path;

            return mockCloudinaryService.deleteFile(publicId, 'image');
          }
        }

        return undefined;
      },
    );

    /**
     * Business rule hiện tại:
     * chỉ DRAFT được submit.
     */
    mockHelper.assertSubmittable.mockImplementation((status: PostStatus) => {
      if (status === PostStatus.DRAFT) {
        return;
      }

      const statusErrors: Record<string, string> = {
        [PostStatus.PENDING_REVIEW]: 'Bài viết này đang chờ Moderator duyệt.',

        [PostStatus.PUBLISH]:
          'Bài viết đã được xuất bản. Chỉ khi chỉnh sửa bài thì bài mới được gửi duyệt lại.',

        [PostStatus.REJECT]:
          'Bài viết bị từ chối phải được chỉnh sửa trước khi gửi duyệt lại.',
      };

      throw new BadRequestException(
        statusErrors[status] ??
          `Không thể gửi duyệt bài viết đang ở trạng thái ${status}.`,
      );
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogownerPostsService,

        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },

        {
          provide: PostsService,
          useValue: mockPostsService,
        },

        {
          provide: BlogownerPostHelperService,
          useValue: mockHelper,
        },

        {
          provide: LibreTranslateService,
          useValue: mockLibreTranslateService,
        },

        {
          provide: BLOGOWNER_TRANSLATION_QUEUE_SERVICE,
          useValue: mockTranslationQueueService,
        },
      ],
    }).compile();

    service = module.get<BlogownerPostsService>(BlogownerPostsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * GROUPED POST LIST
   */

  it('should group root posts with their translations and aggregate view/like totals', async () => {
    const rootUpdatedAt = new Date('2026-08-01T10:00:00.000Z');
    const translationUpdatedAt = new Date('2026-08-03T10:00:00.000Z');
    const secondRootUpdatedAt = new Date('2026-08-02T10:00:00.000Z');

    mockPrismaService.post.findMany
      .mockResolvedValueOnce([
        { id: 101, parentPostId: null },
        { id: 102, parentPostId: 101 },
        { id: 201, parentPostId: null },
      ])
      .mockResolvedValueOnce([{ id: 101 }, { id: 201 }])
      .mockResolvedValueOnce([
        {
          id: 101,
          parentPostId: null,
          updatedAt: rootUpdatedAt,
          viewCount: 100,
          _count: { postLikes: 5 },
        },
        {
          id: 102,
          parentPostId: 101,
          updatedAt: translationUpdatedAt,
          viewCount: 20,
          _count: { postLikes: 2 },
        },
        {
          id: 201,
          parentPostId: null,
          updatedAt: secondRootUpdatedAt,
          viewCount: 90,
          _count: { postLikes: 10 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 201,
          title: 'Root B',
          parentPostId: null,
          status: PostStatus.DRAFT,
          viewCount: 90,
          updatedAt: secondRootUpdatedAt,
          language: { code: 'vi' },
          _count: { postLikes: 10 },
        },
        {
          id: 102,
          title: 'Root A English',
          parentPostId: 101,
          status: PostStatus.DRAFT,
          viewCount: 20,
          updatedAt: translationUpdatedAt,
          language: { code: 'en' },
          _count: { postLikes: 2 },
        },
        {
          id: 101,
          title: 'Root A',
          parentPostId: null,
          status: PostStatus.PUBLISH,
          viewCount: 100,
          updatedAt: rootUpdatedAt,
          language: { code: 'vi' },
          _count: { postLikes: 5 },
        },
      ]);

    const result = await service.findAll(
      3,
      {},
      {
        skip: 0,
        take: 10,
        page: 1,
      },
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0].root.id).toBe(101);
    /**
     * findAll() (list) không còn trả translations — chỉ findOne()
     * (detail) mới trả bản dịch. Xem comment "Response list vẫn giữ
     * wrapper hiện tại..." trong blogowner-posts.service.ts.
     */
    expect(result.items[0].translations).toEqual([]);
    expect(result.items[0].totals).toEqual({
      views: 120,
      likes: 7,
    });
    expect(result.items[0].latestUpdatedAt).toEqual(translationUpdatedAt);

    expect(result.items[1].root.id).toBe(201);
    expect(result.items[1].translations).toHaveLength(0);

    expect(result.meta).toEqual({
      totalItems: 2,
      itemCount: 2,
      itemsPerPage: 10,
      totalPages: 1,
      currentPage: 1,
    });
  });

  it('should sort groups by total views and paginate by group', async () => {
    const updatedAt = new Date('2026-08-01T10:00:00.000Z');

    mockPrismaService.post.findMany
      .mockResolvedValueOnce([
        { id: 101, parentPostId: null },
        { id: 102, parentPostId: 101 },
        { id: 201, parentPostId: null },
      ])
      .mockResolvedValueOnce([{ id: 101 }, { id: 201 }])
      .mockResolvedValueOnce([
        {
          id: 101,
          parentPostId: null,
          updatedAt,
          viewCount: 100,
          _count: { postLikes: 1 },
        },
        {
          id: 102,
          parentPostId: 101,
          updatedAt,
          viewCount: 100,
          _count: { postLikes: 1 },
        },
        {
          id: 201,
          parentPostId: null,
          updatedAt,
          viewCount: 150,
          _count: { postLikes: 20 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 201,
          title: 'Root B',
          parentPostId: null,
          status: PostStatus.DRAFT,
          viewCount: 150,
          updatedAt,
          language: { code: 'vi' },
          _count: { postLikes: 20 },
        },
      ]);

    const result = await service.findAll(
      3,
      {
        sortBy: 'viewCount',
        sortOrder: 'desc',
      },
      {
        skip: 1,
        take: 1,
        page: 2,
      },
    );

    /**
     * Group 101 có 200 views, group 201 có 150 views.
     * Page 2 / limit 1 phải trả group 201.
     */
    expect(result.items).toHaveLength(1);
    expect(result.items[0].root.id).toBe(201);
    expect(result.items[0].totals.views).toBe(150);
    expect(result.meta.totalItems).toBe(2);
    expect(result.meta.totalPages).toBe(2);
    expect(result.meta.currentPage).toBe(2);
  });

  it('should use filters only to select matching groups and still return the full active group', async () => {
    const updatedAt = new Date('2026-08-01T10:00:00.000Z');

    mockPrismaService.post.findMany
      .mockResolvedValueOnce([
        /** Chỉ translation EN khớp status DRAFT. */
        { id: 102, parentPostId: 101 },
      ])
      .mockResolvedValueOnce([{ id: 101 }])
      .mockResolvedValueOnce([
        {
          id: 101,
          parentPostId: null,
          updatedAt,
          viewCount: 100,
          _count: { postLikes: 5 },
        },
        {
          id: 102,
          parentPostId: 101,
          updatedAt,
          viewCount: 20,
          _count: { postLikes: 2 },
        },
        {
          id: 103,
          parentPostId: 101,
          updatedAt,
          viewCount: 10,
          _count: { postLikes: 1 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 101,
          title: 'Root',
          parentPostId: null,
          status: PostStatus.PUBLISH,
          viewCount: 100,
          updatedAt,
          language: { code: 'vi' },
          _count: { postLikes: 5 },
        },
        {
          id: 102,
          title: 'English draft',
          parentPostId: 101,
          status: PostStatus.DRAFT,
          viewCount: 20,
          updatedAt,
          language: { code: 'en' },
          _count: { postLikes: 2 },
        },
        {
          id: 103,
          title: 'French publish',
          parentPostId: 101,
          status: PostStatus.PUBLISH,
          viewCount: 10,
          updatedAt,
          language: { code: 'fr' },
          _count: { postLikes: 1 },
        },
      ]);

    const result = await service.findAll(
      3,
      {
        status: PostStatus.DRAFT,
      },
      {
        skip: 0,
        take: 10,
        page: 1,
      },
    );

    expect(
      mockPrismaService.post.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      authorId: 3,
      deletedAt: null,
      status: PostStatus.DRAFT,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].root.id).toBe(101);
    /**
     * findAll() (list) không còn trả translations — chỉ findOne()
     * (detail) mới trả bản dịch.
     */
    expect(result.items[0].translations).toEqual([]);
  });

  /**
   * CREATE POST
   */

  it('should reject creating a post with forbidden words before saving', async () => {
    await expect(
      service.create(3, {
        title: 'Bài viết dm',
        content: '<p>Nội dung bình thường</p>',
        languageId: 4,
        categoryIds: [13],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Tiêu đề hoặc nội dung bài viết chứa từ ngữ không phù hợp với tiêu chuẩn cộng đồng.',
      ),
    );

    expect(mockPostsService.create).not.toHaveBeenCalled();
    expect(mockTranslationQueueService.enqueueBatch).not.toHaveBeenCalled();
  });

  it('should validate thumbnail before creating the draft row', async () => {
    const thumbnailFile = {
      fieldname: 'thumbnail',
      originalname: 'fake.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 20,
      buffer: Buffer.from('<html>not an image</html>'),
    } as Express.Multer.File;

    mockHelper.validateThumbnailFile.mockImplementationOnce(() => {
      throw new BadRequestException(
        'Ảnh bìa chỉ hỗ trợ file JPEG, PNG hoặc WEBP hợp lệ.',
      );
    });

    await expect(
      service.create(
        3,
        {
          title: 'Bài hợp lệ',
          content: '<p>Nội dung hợp lệ</p>',
          languageId: 4,
          categoryIds: [13],
        },
        thumbnailFile,
      ),
    ).rejects.toThrow(
      'Ảnh bìa chỉ hỗ trợ file JPEG, PNG hoặc WEBP hợp lệ.',
    );

    expect(mockHelper.validateThumbnailFile).toHaveBeenCalledWith(
      thumbnailFile,
    );
    expect(mockPostsService.create).not.toHaveBeenCalled();
    expect(mockHelper.uploadThumbnail).not.toHaveBeenCalled();
  });

  it('should create a post as draft when submitForReview is false', async () => {
    mockPostsService.create.mockResolvedValue({
      id: 20,
    });

    mockHelper.uploadMediaFiles.mockResolvedValue(undefined);

    jest.spyOn(service, 'findOne').mockResolvedValue(
      new BlogownerPostEntity({
        id: 20,
        title: 'Draft Post',
        status: PostStatus.DRAFT,
      }),
    );

    const result = await service.create(3, {
      title: 'Draft Post',
      content: 'Draft content',
      languageId: 4,
      categoryIds: [13],
      submitForReview: false,
    });

    expect(mockPostsService.create).toHaveBeenCalledWith(3, {
      title: 'Draft Post',
      content: 'Draft content',
      languageId: 4,
      categoryIds: [13],
      status: PostStatus.DRAFT,
    });

    expect(mockHelper.uploadMediaFiles).toHaveBeenCalledWith(20, undefined);

    expect(mockPrismaService.post.update).not.toHaveBeenCalled();

    expect(service.findOne).toHaveBeenCalledWith(3, 20);

    expect(result.status).toBe(PostStatus.DRAFT);
  });

  it('should create a post as draft when submitForReview is omitted', async () => {
    mockPostsService.create.mockResolvedValue({
      id: 22,
    });

    mockHelper.uploadMediaFiles.mockResolvedValue(undefined);

    jest.spyOn(service, 'findOne').mockResolvedValue(
      new BlogownerPostEntity({
        id: 22,
        title: 'Backward Compatible Post',
        status: PostStatus.DRAFT,
      }),
    );

    const result = await service.create(3, {
      title: 'Backward Compatible Post',
      content: 'Content',
      languageId: 4,
      categoryIds: [13],
    });

    expect(mockPostsService.create).toHaveBeenCalledWith(3, {
      title: 'Backward Compatible Post',
      content: 'Content',
      languageId: 4,
      categoryIds: [13],
      status: PostStatus.DRAFT,
    });

    expect(mockPrismaService.post.update).not.toHaveBeenCalled();

    expect(result.status).toBe(PostStatus.DRAFT);
  });

  it('should submit a newly created post for review when submitForReview is true', async () => {
    mockPostsService.create.mockResolvedValue({
      id: 21,
    });

    mockHelper.uploadMediaFiles.mockResolvedValue(undefined);

    mockHelper.updateOwnedPostGroupStatus.mockResolvedValue(undefined);

    jest.spyOn(service, 'findOne').mockResolvedValue(
      new BlogownerPostEntity({
        id: 21,
        title: 'Ready Post',
        status: PostStatus.PENDING_REVIEW,
      }),
    );

    const result = await service.create(3, {
      title: 'Ready Post',
      content: 'Ready content',
      languageId: 4,
      categoryIds: [13],
      submitForReview: true,
    });

    expect(mockPostsService.create).toHaveBeenCalledWith(3, {
      title: 'Ready Post',
      content: 'Ready content',
      languageId: 4,
      categoryIds: [13],
      status: PostStatus.DRAFT,
    });

    expect(mockHelper.updateOwnedPostGroupStatus).toHaveBeenCalledWith(
      3,
      21,
      PostStatus.PENDING_REVIEW,
    );

    /**
     * Thứ tự bắt buộc:
     * create DRAFT
     * -> upload media
     * -> PENDING_REVIEW.
     */
    expect(mockPostsService.create.mock.invocationCallOrder[0]).toBeLessThan(
      mockHelper.uploadMediaFiles.mock.invocationCallOrder[0],
    );

    expect(
      mockHelper.uploadMediaFiles.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockHelper.updateOwnedPostGroupStatus.mock.invocationCallOrder[0],
    );

    expect(service.findOne).toHaveBeenCalledWith(3, 21);

    expect(result.status).toBe(PostStatus.PENDING_REVIEW);
  });

  it('should delete newly uploaded thumbnail when saving its URL fails during post creation', async () => {
    const thumbnailFile = {
      mimetype: 'image/png',
      buffer: Buffer.from('fake-thumbnail'),
      originalname: 'create-thumbnail.png',
    } as Express.Multer.File;

    const uploadedThumbnailUrl =
      'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/30/thumbnail/create-thumbnail.png';

    const databaseError = new Error('Database update failed');

    /**
     * Post đã được tạo dưới trạng thái DRAFT.
     */
    mockPostsService.create.mockResolvedValue({
      id: 30,
    });

    /**
     * Thumbnail upload lên Cloudinary thành công.
     */
    mockCloudinaryService.uploadFile.mockResolvedValue({
      secure_url: uploadedThumbnailUrl,

      public_id: 'nestjs_blog/posts/30/thumbnail/create-thumbnail',
    });

    /**
     * Nhưng database không lưu được thumbnailUrl.
     */
    mockPrismaService.post.update.mockRejectedValueOnce(databaseError);

    await expect(
      service.create(
        3,
        {
          title: 'Post with thumbnail',
          content: 'Post content',
          languageId: 4,
          categoryIds: [13],
          submitForReview: false,
        },
        thumbnailFile,
      ),
    ).rejects.toBe(databaseError);

    /**
     * Bài viết luôn được tạo DRAFT trước.
     */
    expect(mockPostsService.create).toHaveBeenCalledWith(3, {
      title: 'Post with thumbnail',
      content: 'Post content',
      languageId: 4,
      categoryIds: [13],
      status: PostStatus.DRAFT,
    });

    /**
     * Thumbnail phải được upload đúng thư mục bài viết.
     */
    expect(mockCloudinaryService.uploadFile).toHaveBeenCalledWith(
      thumbnailFile,
      'nestjs_blog/posts/30/thumbnail',
    );

    /**
     * Backend đã cố lưu URL thumbnail vào database.
     */
    expect(mockPrismaService.post.update).toHaveBeenCalledWith({
      where: {
        id: 30,
      },

      data: {
        thumbnailUrl: uploadedThumbnailUrl,
      },
    });

    /**
     * Khi database update thất bại,
     * thumbnail vừa upload phải bị xóa.
     */
    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'nestjs_blog/posts/30/thumbnail/create-thumbnail',
      'image',
    );

    /**
     * Không được upload media hoặc đi tiếp tới findOne()
     * sau khi lưu thumbnail thất bại.
     */
    expect(mockHelper.uploadMediaFiles).not.toHaveBeenCalled();

    expect(mockPrismaService.post.findFirst).not.toHaveBeenCalled();

    /**
     * Lỗi database ban đầu phải được giữ nguyên,
     * không bị lỗi cleanup ghi đè.
     */
    expect(mockPrismaService.post.update).toHaveBeenCalledTimes(1);
  });


  it('should enqueue translations and keep root as draft during async translation', async () => {
    const sourceUpdatedAt = new Date('2026-09-10T01:00:00.000Z');

    mockPostsService.create.mockResolvedValue({
      id: 40,
    });

    mockHelper.uploadMediaFiles.mockResolvedValue(undefined);

    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 40,
      languageId: 4,
      updatedAt: sourceUpdatedAt,
    });

    mockTranslationQueueService.enqueueBatch.mockResolvedValue({
      batchId: 'translation-batch-40-test',
      targetLanguageIds: [5, 6],
    });

    jest.spyOn(service, 'findOne').mockResolvedValue(
      new BlogownerPostEntity({
        id: 40,
        title: 'Bài gốc',
        status: PostStatus.DRAFT,
        languageId: 4,
      }),
    );

    const result = await service.create(3, {
      title: 'Bài gốc',
      content: '<p>Nội dung</p>',
      languageId: 4,
      categoryIds: [13],
      translationLanguageIds: [5, 6],
      submitForReview: true,
    });

    expect(mockPostsService.create).toHaveBeenCalledWith(3, {
      title: 'Bài gốc',
      content: '<p>Nội dung</p>',
      languageId: 4,
      categoryIds: [13],
      status: PostStatus.DRAFT,
    });

    /**
     * Còn translation chạy background nên HTTP request
     * chưa được chuyển group sang PENDING_REVIEW.
     */
    expect(mockHelper.updateOwnedPostGroupStatus).not.toHaveBeenCalled();

    expect(mockTranslationQueueService.enqueueBatch).toHaveBeenCalledWith({
      rootPostId: 40,
      ownerId: 3,
      sourceLanguageId: 4,
      sourceUpdatedAt: sourceUpdatedAt.toISOString(),
      targetLanguageIds: [5, 6],
      submitForReview: true,
    });

    /**
     * Request create không còn gọi LibreTranslate trực tiếp.
     */
    expect(mockLibreTranslateService.translateTexts).not.toHaveBeenCalled();

    expect(service.findOne).toHaveBeenCalledWith(3, 40);
    expect(result.status).toBe(PostStatus.DRAFT);
    expect(
      result.translationBatch,
    ).toEqual({
      batchId:
        'translation-batch-40-test',

      status: 'QUEUED',
    });
  });

  it('should reject translation target equal to source language when creating', async () => {
    await expect(
      service.create(3, {
        title: 'Vietnamese post',
        content: 'Content',
        languageId: 4,
        categoryIds: [13],
        translationLanguageIds: [4, 5],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Ngôn ngữ bản dịch không được trùng với ngôn ngữ bài gốc.',
      ),
    );

    expect(mockPostsService.create).not.toHaveBeenCalled();
    expect(mockTranslationQueueService.enqueueBatch).not.toHaveBeenCalled();
  });

  /**
   * TRANSLATION GROUP
   */

  it('should return all translations in the same translation group', async () => {
    mockHelper.findOwnedPost.mockResolvedValue({
      id: 15,
      title: 'English Post',
      thumbnailUrl: null,
      parentPostId: 1,
      authorId: 99,
      languageId: 5,
      status: PostStatus.DRAFT,
    });

    mockPrismaService.post.findMany.mockResolvedValue([
      {
        id: 15,
        title: 'English Post',
        thumbnailUrl: null,
        status: PostStatus.DRAFT,
        parentPostId: 1,
        languageId: 5,

        language: {
          id: 5,
          code: 'en',
          name: 'English',
          flag: 'us',
        },
      },

      {
        id: 1,
        title: 'Bài tiếng Việt',
        thumbnailUrl: null,
        status: PostStatus.PUBLISH,
        parentPostId: null,
        languageId: 4,

        language: {
          id: 4,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: 'vn',
        },
      },
    ]);

    const result = await service.findOne(99, 15);

    expect(mockHelper.findOwnedPost).toHaveBeenCalledWith(
      99,
      15,
      expect.any(Object),
    );

    expect(mockPrismaService.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          authorId: 99,
          deletedAt: null,

          OR: [
            {
              id: 1,
            },
            {
              parentPostId: 1,
            },
          ],
        },
      }),
    );

    expect(result.translations).toHaveLength(2);

    expect(result.translations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,

          language: expect.objectContaining({
            code: 'vi',
          }),
        }),

        expect.objectContaining({
          id: 15,

          language: expect.objectContaining({
            code: 'en',
          }),
        }),
      ]),
    );
  });

  /**
   * TRANSLATE PREVIEW
   */

  it('should translate title and content for preview without creating a post', async () => {
    mockPrismaService.post.findFirst
      /**
       * Source Post.
       */
      .mockResolvedValueOnce({
        id: 1,
        authorId: 3,
        parentPostId: null,

        title: 'Hướng dẫn NestJS',

        content: '<p>Nội dung tiếng Việt</p>',

        thumbnailUrl: null,

        language: {
          id: 4,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: 'vn',
        },

        postCategories: [
          {
            category: {
              categoryGroupId: 10,
            },
          },
        ],
      })

      /**
       * Chưa có EN đang active.
       */
      .mockResolvedValueOnce(null);

    mockPrismaService.language.findFirst.mockResolvedValue({
      id: 5,
      code: 'en',
      name: 'English',
      flag: 'us',
    });

    mockPrismaService.category.findMany.mockResolvedValue([
      {
        categoryGroupId: 10,
      },
    ]);

    mockLibreTranslateService.translateTexts.mockResolvedValue([
      'NestJS Guide',
      '<p>English content</p>',
    ]);

    const result = await service.translatePreview(3, 1, {
      targetLanguageId: 5,
    });

    expect(
      mockLibreTranslateService.translateTexts,
    ).toHaveBeenCalledWith({
      texts: [
        'Hướng dẫn NestJS',
        '<p>Nội dung tiếng Việt</p>',
      ],

      sourceLanguageCode: 'vi',
      targetLanguageCode: 'en',

      format: 'html',
    });

    /**
     * Preview tuyệt đối không được tạo
     * hoặc update Post.
     */
    expect(mockPostsService.create).not.toHaveBeenCalled();

    expect(mockPrismaService.post.update).not.toHaveBeenCalled();

    expect(result.translation).toEqual({
      language: {
        id: 5,
        code: 'en',
        name: 'English',
        flag: 'us',
      },

      title: 'NestJS Guide',
      content: '<p>English content</p>',
    });
  });
  it('should reject translate preview when target language is inactive', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 1,
      authorId: 3,
      parentPostId: null,

      title: 'Hướng dẫn NestJS',
      content: '<p>Nội dung tiếng Việt</p>',
      thumbnailUrl: null,

      language: {
        id: 4,
        code: 'vi',
        name: 'Tiếng Việt',
        flag: 'vn',
      },

      postCategories: [
        {
          category: {
            categoryGroupId: 10,
          },
        },
      ],
    });

    /**
     * Query target language với:
     * deletedAt: null,
     * isActive: true
     *
     * Không tìm thấy => language bị disable
     * hoặc không tồn tại.
     */
    mockPrismaService.language.findFirst.mockResolvedValue(null);

    await expect(
      service.translatePreview(3, 1, {
        targetLanguageId: 5,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrismaService.language.findFirst).toHaveBeenCalledWith({
      where: {
        id: 5,
        deletedAt: null,
        isActive: true,
      },

      select: expect.any(Object),
    });

    expect(mockLibreTranslateService.translateTexts).not.toHaveBeenCalled();

    expect(mockPrismaService.category.findMany).not.toHaveBeenCalled();

    expect(mockPostsService.create).not.toHaveBeenCalled();

    expect(mockPrismaService.post.update).not.toHaveBeenCalled();
  });

  /**
   * UPDATE POST
   */

  it('should reject updating a post with forbidden words before saving', async () => {
    const root = {
      id: 100,
      authorId: 3,
      parentPostId: null,
      languageId: 4,
      status: PostStatus.DRAFT,
      title: 'Root',
      content: 'Root content',
      thumbnailUrl: null,
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 100,
      root,
      translations: [],
      posts: [root],
    });

    await expect(
      service.update(3, 100, {
        content: '<p>Nội dung có từ ngu không phù hợp.</p>',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Tiêu đề hoặc nội dung bài viết chứa từ ngữ không phù hợp với tiêu chuẩn cộng đồng.',
      ),
    );

    expect(mockPostsService.update).not.toHaveBeenCalled();
    expect(mockTranslationQueueService.enqueueBatch).not.toHaveBeenCalled();
  });

  it('should enqueue all existing and newly selected translations when updating root', async () => {
    const root = {
      id: 100,
      authorId: 3,
      title: 'Bài cũ',
      content: 'Nội dung cũ',
      status: PostStatus.PUBLISH,
      languageId: 4,
      thumbnailUrl: null,
    };

    const translations = [
      {
        id: 101,
        authorId: 3,
        parentPostId: 100,
        languageId: 5,
        status: PostStatus.PUBLISH,
      },
      {
        id: 102,
        authorId: 3,
        parentPostId: 100,
        languageId: 6,
        status: PostStatus.DRAFT,
      },
    ];

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 100,
      root,
      translations,
      posts: [root, ...translations],
    });

    mockPostsService.update.mockResolvedValue({
      id: 100,
    });

    mockHelper.updateOwnedPostGroupStatus.mockResolvedValue(undefined);
    mockHelper.uploadMediaFiles.mockResolvedValue(undefined);

    const sourceUpdatedAt = new Date('2026-09-10T02:00:00.000Z');

    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 100,
      languageId: 4,
      updatedAt: sourceUpdatedAt,
    });

    mockTranslationQueueService.enqueueBatch.mockResolvedValue({
      batchId: 'translation-batch-100-test',
      targetLanguageIds: [5, 6, 7],
    });

    jest.spyOn(service, 'findOne').mockResolvedValue(
      new BlogownerPostEntity({
        id: 100,
        title: 'Bài mới',
        status: PostStatus.DRAFT,
      }),
    );

    const result = await service.update(3, 100, {
      title: 'Bài mới',
      translationLanguageIds: [5, 7],
      submitForReview: true,
    });

    expect(mockPostsService.update).toHaveBeenCalledWith(
      100,
      expect.objectContaining({
        title: 'Bài mới',
        status: PostStatus.DRAFT,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
      }),
    );

    /**
     * Existing: 5, 6
     * Selected: 5, 7
     * Batch:    5, 6, 7
     */
    expect(mockTranslationQueueService.enqueueBatch).toHaveBeenCalledWith({
      rootPostId: 100,
      ownerId: 3,
      sourceLanguageId: 4,
      sourceUpdatedAt: sourceUpdatedAt.toISOString(),
      targetLanguageIds: [5, 6, 7],
      submitForReview: true,
    });

    expect(mockLibreTranslateService.translateTexts).not.toHaveBeenCalled();

    /**
     * Trong lúc worker dịch lại, toàn bộ group phải ở DRAFT.
     */
    expect(mockHelper.updateOwnedPostGroupStatus).toHaveBeenCalledWith(
      3,
      100,
      PostStatus.DRAFT,
    );

    expect(result.status).toBe(PostStatus.DRAFT);
    expect(
      result.translationBatch,
    ).toEqual({
      batchId:
        'translation-batch-100-test',

      status: 'QUEUED',
    });
  });

  it('should reject updating a translation directly', async () => {
    const root = {
      id: 100,
      authorId: 3,
      languageId: 4,
      status: PostStatus.DRAFT,
      thumbnailUrl: null,
    };

    const translation = {
      id: 101,
      authorId: 3,
      parentPostId: 100,
      languageId: 5,
      status: PostStatus.DRAFT,
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 100,
      root,
      translations: [translation],
      posts: [root, translation],
    });

    await expect(
      service.update(3, 101, {
        title: 'Không được sửa trực tiếp',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Chỉ được chỉnh sửa bài gốc. Các bản dịch sẽ được tự động đồng bộ từ bài gốc.',
      ),
    );

    expect(mockPostsService.update).not.toHaveBeenCalled();
    expect(mockTranslationQueueService.enqueueBatch).not.toHaveBeenCalled();
  });

  it('should reject an empty update without changing post status', async () => {
    const root = {
      id: 3,
      authorId: 3,
      status: PostStatus.REJECT,
      languageId: 4,
      thumbnailUrl: null,

      rejectionReason: 'Nội dung chưa đạt yêu cầu.',
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 3,
      root,
      translations: [],
      posts: [root],
    });

    await expect(service.update(3, 3, {})).rejects.toThrow(
      new BadRequestException('Không có dữ liệu nào để cập nhật.'),
    );

    expect(mockHelper.assertEditable).toHaveBeenCalledWith(PostStatus.REJECT);

    /**
     * Không được tính trạng thái tiếp theo
     * nếu request thực tế không chỉnh sửa gì.
     */
    expect(mockHelper.getNextStatusOnEdit).not.toHaveBeenCalled();

    expect(mockPostsService.update).not.toHaveBeenCalled();

    expect(mockHelper.uploadThumbnail).not.toHaveBeenCalled();

    expect(mockHelper.uploadMediaFiles).not.toHaveBeenCalled();

    expect(mockHelper.resetReviewOnEdit).not.toHaveBeenCalled();

    expect(mockPrismaService.post.update).not.toHaveBeenCalled();
  });

  it('should reset review metadata before uploading media when editing a published post', async () => {
    const mediaFile = {
      mimetype: 'image/png',
      buffer: Buffer.from('fake-media'),
      originalname: 'media.png',
    } as Express.Multer.File;

    const root = {
      id: 1,
      authorId: 3,
      status: PostStatus.PUBLISH,
      languageId: 4,
      thumbnailUrl: null,

      reviewedById: 8,
      reviewedAt: new Date('2026-07-30T08:00:00.000Z'),
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 1,
      root,
      translations: [],
      posts: [root],
    });

    mockPostsService.update.mockResolvedValue({
      id: 1,
    });

    /**
     * Giả lập media upload thất bại sau khi
     * nội dung/status đã được update.
     */
    mockHelper.uploadMediaFiles.mockRejectedValue(
      new Error('Media upload failed'),
    );

    await expect(
      service.update(
        3,
        1,
        {
          title: 'Updated published post',
        },
        undefined,
        [mediaFile],
      ),
    ).rejects.toThrow('Media upload failed');

    /**
     * Bài PUBLISH phải được đưa về DRAFT trong lúc xử lý
     * (chỉ khi toàn bộ group xử lý xong mới đổi sang
     * finalStatus qua updateOwnedPostGroupStatus).
     */
    expect(mockPostsService.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: 'Updated published post',
        status: PostStatus.DRAFT,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
      }),
    );

    expect(mockHelper.uploadMediaFiles).toHaveBeenCalledWith(1, [mediaFile]);

    /**
     * Quan trọng nhất:
     * nội dung/status phải được update TRƯỚC khi upload media.
     */
    expect(mockPostsService.update.mock.invocationCallOrder[0]).toBeLessThan(
      mockHelper.uploadMediaFiles.mock.invocationCallOrder[0],
    );

    /**
     * Vì upload media bị lỗi nên không được
     * đi tiếp tới findOne().
     */
    expect(mockPrismaService.post.findFirst).not.toHaveBeenCalled();
  });
  /**
   * THUMBNAIL
   */

  it('should upload new thumbnail before deleting old thumbnail', async () => {
    const thumbnailFile = {
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image'),
      originalname: 'new-thumbnail.png',
    } as Express.Multer.File;

    const root = {
      id: 1,
      authorId: 3,

      status: PostStatus.DRAFT,

      languageId: 4,

      thumbnailUrl:
        'https://res.cloudinary.com/demo/image/upload/v123/nestjs_blog/posts/1/thumbnail/old-thumbnail.png',
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 1,
      root,
      translations: [],
      posts: [root],
    });

    mockCloudinaryService.uploadFile.mockResolvedValue({
      secure_url:
        'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

      public_id: 'nestjs_blog/posts/1/thumbnail/new-thumbnail',
    });

    mockPostsService.update.mockResolvedValue({
      id: 1,
    });

    mockHelper.updateOwnedPostGroupStatus.mockResolvedValue(undefined);

    mockHelper.uploadMediaFiles.mockResolvedValue(undefined);

    jest.spyOn(service, 'findOne').mockResolvedValue(
      new BlogownerPostEntity({
        id: 1,
        status: PostStatus.DRAFT,

        thumbnailUrl:
          'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',
      }),
    );

    await service.update(
      3,
      1,
      {
        title: 'Updated title',
      },
      thumbnailFile,
    );

    expect(mockCloudinaryService.uploadFile).toHaveBeenCalledWith(
      thumbnailFile,
      'nestjs_blog/posts/1/thumbnail',
    );

    expect(mockPostsService.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: 'Updated title',

        thumbnailUrl:
          'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

        status: PostStatus.DRAFT,
      }),
    );

    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'nestjs_blog/posts/1/thumbnail/old-thumbnail',
      'image',
    );

    expect(
      mockCloudinaryService.uploadFile.mock.invocationCallOrder[0],
    ).toBeLessThan(mockPostsService.update.mock.invocationCallOrder[0]);

    expect(mockPostsService.update.mock.invocationCallOrder[0]).toBeLessThan(
      mockCloudinaryService.deleteFile.mock.invocationCallOrder[0],
    );
  });

  it('should delete newly uploaded thumbnail when database update fails', async () => {
    const thumbnailFile = {
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image'),
      originalname: 'new-thumbnail.png',
    } as Express.Multer.File;

    const root = {
      id: 1,
      authorId: 3,

      status: PostStatus.DRAFT,

      languageId: 4,

      thumbnailUrl:
        'https://res.cloudinary.com/demo/image/upload/v123/nestjs_blog/posts/1/thumbnail/old-thumbnail.png',
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 1,
      root,
      translations: [],
      posts: [root],
    });

    mockCloudinaryService.uploadFile.mockResolvedValue({
      secure_url:
        'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

      public_id: 'nestjs_blog/posts/1/thumbnail/new-thumbnail',
    });

    mockPostsService.update.mockRejectedValue(
      new Error('Database update failed'),
    );

    await expect(
      service.update(
        3,
        1,
        {
          title: 'Updated title',
        },
        thumbnailFile,
      ),
    ).rejects.toThrow('Database update failed');

    expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
      'nestjs_blog/posts/1/thumbnail/new-thumbnail',
      'image',
    );

    expect(mockCloudinaryService.deleteFile).not.toHaveBeenCalledWith(
      'nestjs_blog/posts/1/thumbnail/old-thumbnail',
      'image',
    );

    expect(mockHelper.resetReviewOnEdit).not.toHaveBeenCalled();
  });

  /**
   * SUBMIT FOR REVIEW
   */

  it('should require a rejected post to be edited before submitting again', async () => {
    const root = {
      id: 3,
      authorId: 3,
      status: PostStatus.REJECT,

      rejectionReason: 'Nội dung chưa đạt yêu cầu.',
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 3,
      root,
      translations: [],
      posts: [root],
    });

    await expect(service.submitForReview(3, 3)).rejects.toThrow(
      new BadRequestException(
        'Bài viết bị từ chối phải được chỉnh sửa trước khi gửi duyệt lại.',
      ),
    );

    expect(mockHelper.updateOwnedPostGroupStatus).not.toHaveBeenCalled();
  });

  it('should reject submit when stored root or translation contains forbidden words', async () => {
    const root = {
      id: 3,
      authorId: 3,
      status: PostStatus.DRAFT,
      title: 'Bài viết hợp lệ',
      content: '<p>Nội dung hợp lệ</p>',
    };

    const translation = {
      id: 4,
      authorId: 3,
      parentPostId: 3,
      status: PostStatus.DRAFT,
      title: 'Translated post',
      content: '<p>Nội dung có từ dm không phù hợp.</p>',
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 3,
      root,
      translations: [translation],
      posts: [root, translation],
    });

    await expect(service.submitForReview(3, 3)).rejects.toThrow(
      new BadRequestException(
        'Bài viết ID 4 chứa từ ngữ không phù hợp và không thể gửi duyệt.',
      ),
    );

    expect(mockHelper.updateOwnedPostGroupStatus).not.toHaveBeenCalled();
  });

  it('should submit a draft post for review', async () => {
    const root = {
      id: 3,
      authorId: 3,
      status: PostStatus.DRAFT,
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 3,
      root,
      translations: [],
      posts: [root],
    });

    mockHelper.updateOwnedPostGroupStatus.mockResolvedValue(undefined);

    jest.spyOn(service, 'findOne').mockResolvedValue(
      new BlogownerPostEntity({
        id: 3,
        authorId: 3,

        status: PostStatus.PENDING_REVIEW,
      }),
    );

    const result = await service.submitForReview(3, 3);

    expect(mockHelper.updateOwnedPostGroupStatus).toHaveBeenCalledWith(
      3,
      3,
      PostStatus.PENDING_REVIEW,
    );

    expect(service.findOne).toHaveBeenCalledWith(3, 3);

    expect(result.status).toBe(PostStatus.PENDING_REVIEW);
  });

  it('should refuse to submit for review while a background translation batch is still running', async () => {
    /**
     * Race condition thật đã gặp: gửi duyệt trong lúc batch dịch nền
     * chưa xong khiến job dịch còn dang dở ghi đè DRAFT lên group đã
     * PENDING_REVIEW — Moderator không duyệt được (group lệch trạng
     * thái), Blog Owner cũng không sửa được (root đang PENDING_REVIEW).
     * submitForReview() phải chặn ngay từ đầu, không cho race xảy ra.
     */
    const root = {
      id: 3,
      authorId: 3,
      status: PostStatus.DRAFT,
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 3,
      root,
      translations: [],
      posts: [root],
    });

    mockTranslationQueueService.hasActiveBatch.mockResolvedValue(true);

    await expect(service.submitForReview(3, 3)).rejects.toThrow(
      new BadRequestException(
        'Bài đang dịch tự động ở chế độ nền, vui lòng đợi dịch xong (xem tiến độ qua translation-batches) rồi mới gửi duyệt.',
      ),
    );

    expect(mockTranslationQueueService.hasActiveBatch).toHaveBeenCalledWith(3);
    expect(mockHelper.updateOwnedPostGroupStatus).not.toHaveBeenCalled();
  });
});
