import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  PostsService,
  PrismaService,
  SearchIndexService,
} from '@app/core';

import { BlogownerPostEntity } from '../entities';
import {
  BlogownerPostHelperService,
  RESET_REVIEW_DATA,
} from './blogowner-post-helper.service';
import { BlogownerPostsService } from './blogowner-posts.service';
import { TranslationService } from './translation.service';

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

  const mockTranslationService = {
    translatePost: jest.fn(),
  };

  const mockSearchIndexService = {
    syncSearchIndex: jest.fn(),
    syncSearchIndexGroup: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    /**
     * Giả lập helper.uploadThumbnail()
     * gọi Cloudinary và trả kết quả upload.
     */
    mockHelper.uploadThumbnail.mockImplementation(
      (
        postId: number,
        file: Express.Multer.File,
      ) =>
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
      (
        url: string | null | undefined,
      ) => {
        if (
          url &&
          url.includes('/upload/')
        ) {
          const parts =
            url.split('/upload/');

          if (parts.length > 1) {
            const path =
              parts[1].replace(
                /^v\d+\//,
                '',
              );

            const dotIndex =
              path.lastIndexOf('.');

            const publicId =
              dotIndex >= 0
                ? path.substring(
                    0,
                    dotIndex,
                  )
                : path;

            return mockCloudinaryService
              .deleteFile(
                publicId,
                'image',
              );
          }
        }

        return undefined;
      },
    );

    /**
     * Business rule hiện tại:
     * chỉ DRAFT được submit.
     */
    mockHelper.assertSubmittable.mockImplementation(
      (status: PostStatus) => {
        if (
          status === PostStatus.DRAFT
        ) {
          return;
        }

        const statusErrors: Record<
          string,
          string
        > = {
          [PostStatus.PENDING_REVIEW]:
            'Bài viết này đang chờ Moderator duyệt.',

          [PostStatus.PUBLISH]:
            'Bài viết đã được xuất bản. Chỉ khi chỉnh sửa bài thì bài mới được gửi duyệt lại.',

          [PostStatus.REJECT]:
            'Bài viết bị từ chối phải được chỉnh sửa trước khi gửi duyệt lại.',
        };

        throw new BadRequestException(
          statusErrors[status] ??
            `Không thể gửi duyệt bài viết đang ở trạng thái ${status}.`,
        );
      },
    );

    const module: TestingModule =
      await Test.createTestingModule({
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
            provide:
              BlogownerPostHelperService,
            useValue: mockHelper,
          },

          {
            provide: TranslationService,
            useValue:
              mockTranslationService,
          },

          {
            provide: SearchIndexService,
            useValue: mockSearchIndexService,
          },
        ],
      }).compile();

    service =
      module.get<BlogownerPostsService>(
        BlogownerPostsService,
      );
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
      .mockResolvedValueOnce([
        { id: 101 },
        { id: 201 },
      ])
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
      .mockResolvedValueOnce([
        { id: 101 },
        { id: 201 },
      ])
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
      .mockResolvedValueOnce([
        { id: 101 },
      ])
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

  it('should create a post as draft when submitForReview is false', async () => {
    mockPostsService.create.mockResolvedValue({
      id: 20,
    });

    mockHelper.uploadMediaFiles
      .mockResolvedValue(undefined);

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(
        new BlogownerPostEntity({
          id: 20,
          title: 'Draft Post',
          status: PostStatus.DRAFT,
        }),
      );

    const result = await service.create(
      3,
      {
        title: 'Draft Post',
        content: 'Draft content',
        languageId: 4,
        categoryIds: [13],
        submitForReview: false,
      },
    );

    expect(
      mockPostsService.create,
    ).toHaveBeenCalledWith(
      3,
      {
        title: 'Draft Post',
        content: 'Draft content',
        languageId: 4,
        categoryIds: [13],
        status: PostStatus.DRAFT,
      },
    );

    expect(
      mockHelper.uploadMediaFiles,
    ).toHaveBeenCalledWith(
      20,
      undefined,
    );

    expect(
      mockPrismaService.post.update,
    ).not.toHaveBeenCalled();

    expect(
      service.findOne,
    ).toHaveBeenCalledWith(
      3,
      20,
    );

    expect(result.status).toBe(
      PostStatus.DRAFT,
    );
  });

  it('should create a post as draft when submitForReview is omitted', async () => {
    mockPostsService.create.mockResolvedValue({
      id: 22,
    });

    mockHelper.uploadMediaFiles
      .mockResolvedValue(undefined);

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(
        new BlogownerPostEntity({
          id: 22,
          title:
            'Backward Compatible Post',
          status: PostStatus.DRAFT,
        }),
      );

    const result = await service.create(
      3,
      {
        title:
          'Backward Compatible Post',
        content: 'Content',
        languageId: 4,
        categoryIds: [13],
      },
    );

    expect(
      mockPostsService.create,
    ).toHaveBeenCalledWith(
      3,
      {
        title:
          'Backward Compatible Post',
        content: 'Content',
        languageId: 4,
        categoryIds: [13],
        status: PostStatus.DRAFT,
      },
    );

    expect(
      mockPrismaService.post.update,
    ).not.toHaveBeenCalled();

    expect(result.status).toBe(
      PostStatus.DRAFT,
    );
  });

  it('should submit a newly created post for review when submitForReview is true', async () => {
    mockPostsService.create.mockResolvedValue({
      id: 21,
    });

    mockHelper.uploadMediaFiles
      .mockResolvedValue(undefined);

    mockHelper.updateOwnedPostGroupStatus
      .mockResolvedValue(undefined);

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(
        new BlogownerPostEntity({
          id: 21,
          title: 'Ready Post',
          status:
            PostStatus.PENDING_REVIEW,
        }),
      );

    const result = await service.create(
      3,
      {
        title: 'Ready Post',
        content: 'Ready content',
        languageId: 4,
        categoryIds: [13],
        submitForReview: true,
      },
    );

    expect(
      mockPostsService.create,
    ).toHaveBeenCalledWith(
      3,
      {
        title: 'Ready Post',
        content: 'Ready content',
        languageId: 4,
        categoryIds: [13],
        status: PostStatus.DRAFT,
      },
    );

    expect(
      mockHelper.updateOwnedPostGroupStatus,
    ).toHaveBeenCalledWith(
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
    expect(
      mockPostsService.create.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      mockHelper.uploadMediaFiles.mock
        .invocationCallOrder[0],
    );

    expect(
      mockHelper.uploadMediaFiles.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      mockHelper.updateOwnedPostGroupStatus.mock
        .invocationCallOrder[0],
    );

    expect(
      service.findOne,
    ).toHaveBeenCalledWith(
      3,
      21,
    );

    expect(result.status).toBe(
      PostStatus.PENDING_REVIEW,
    );
  });

  it('should delete newly uploaded thumbnail when saving its URL fails during post creation', async () => {
  const thumbnailFile = {
    mimetype: 'image/png',
    buffer: Buffer.from(
      'fake-thumbnail',
    ),
    originalname:
      'create-thumbnail.png',
  } as Express.Multer.File;

  const uploadedThumbnailUrl =
    'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/30/thumbnail/create-thumbnail.png';

  const databaseError =
    new Error(
      'Database update failed',
    );

  /**
   * Post đã được tạo dưới trạng thái DRAFT.
   */
  mockPostsService.create
    .mockResolvedValue({
      id: 30,
    });

  /**
   * Thumbnail upload lên Cloudinary thành công.
   */
  mockCloudinaryService.uploadFile
    .mockResolvedValue({
      secure_url:
        uploadedThumbnailUrl,

      public_id:
        'nestjs_blog/posts/30/thumbnail/create-thumbnail',
    });

  /**
   * Nhưng database không lưu được thumbnailUrl.
   */
  mockPrismaService.post.update
    .mockRejectedValueOnce(
      databaseError,
    );

  await expect(
    service.create(
      3,
      {
        title:
          'Post with thumbnail',
        content:
          'Post content',
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
  expect(
    mockPostsService.create,
  ).toHaveBeenCalledWith(
    3,
    {
      title:
        'Post with thumbnail',
      content:
        'Post content',
      languageId: 4,
      categoryIds: [13],
      status:
        PostStatus.DRAFT,
    },
  );

  /**
   * Thumbnail phải được upload đúng thư mục bài viết.
   */
  expect(
    mockCloudinaryService.uploadFile,
  ).toHaveBeenCalledWith(
    thumbnailFile,
    'nestjs_blog/posts/30/thumbnail',
  );

  /**
   * Backend đã cố lưu URL thumbnail vào database.
   */
  expect(
    mockPrismaService.post.update,
  ).toHaveBeenCalledWith({
    where: {
      id: 30,
    },

    data: {
      thumbnailUrl:
        uploadedThumbnailUrl,
    },
  });

  /**
   * Khi database update thất bại,
   * thumbnail vừa upload phải bị xóa.
   */
  expect(
    mockCloudinaryService.deleteFile,
  ).toHaveBeenCalledWith(
    'nestjs_blog/posts/30/thumbnail/create-thumbnail',
    'image',
  );

  /**
   * Không được upload media hoặc đi tiếp tới findOne()
   * sau khi lưu thumbnail thất bại.
   */
  expect(
    mockHelper.uploadMediaFiles,
  ).not.toHaveBeenCalled();

  expect(
    mockPrismaService.post.findFirst,
  ).not.toHaveBeenCalled();

  /**
   * Lỗi database ban đầu phải được giữ nguyên,
   * không bị lỗi cleanup ghi đè.
   */
  expect(
    mockPrismaService.post.update,
  ).toHaveBeenCalledTimes(1);
});

  /**
   * TRANSLATION GROUP
   */

  it('should return all translations in the same translation group', async () => {
    mockHelper.findOwnedPost
      .mockResolvedValue({
        id: 15,
        title: 'English Post',
        thumbnailUrl: null,
        parentPostId: 1,
        authorId: 99,
        languageId: 5,
        status: PostStatus.DRAFT,
      });

    mockPrismaService.post.findMany
      .mockResolvedValue([
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

    const result =
      await service.findOne(
        99,
        15,
      );

    expect(
      mockHelper.findOwnedPost,
    ).toHaveBeenCalledWith(
      99,
      15,
      expect.any(Object),
    );

    expect(
      mockPrismaService.post.findMany,
    ).toHaveBeenCalledWith(
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

    expect(
      result.translations,
    ).toHaveLength(2);

    expect(
      result.translations,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,

          language:
            expect.objectContaining({
              code: 'vi',
            }),
        }),

        expect.objectContaining({
          id: 15,

          language:
            expect.objectContaining({
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

        title:
          'Hướng dẫn NestJS',

        content:
          '<p>Nội dung tiếng Việt</p>',

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

    mockPrismaService.language.findFirst
      .mockResolvedValue({
        id: 5,
        code: 'en',
        name: 'English',
        flag: 'us',
      });

    mockPrismaService.category.findMany
      .mockResolvedValue([
        {
          categoryGroupId: 10,
        },
      ]);

    mockTranslationService.translatePost
      .mockResolvedValue({
        title: 'NestJS Guide',
        content:
          '<p>English content</p>',
      });

    const result =
      await service.translatePreview(
        3,
        1,
        {
          targetLanguageId: 5,
        },
      );

    expect(
      mockTranslationService.translatePost,
    ).toHaveBeenCalledWith({
      title:
        'Hướng dẫn NestJS',

      content:
        '<p>Nội dung tiếng Việt</p>',

      sourceLanguageCode: 'vi',
      targetLanguageCode: 'en',
    });

    /**
     * Preview tuyệt đối không được tạo
     * hoặc update Post.
     */
    expect(
      mockPostsService.create,
    ).not.toHaveBeenCalled();

    expect(
      mockPrismaService.post.update,
    ).not.toHaveBeenCalled();

    expect(
      result.translation,
    ).toEqual({
      language: {
        id: 5,
        code: 'en',
        name: 'English',
        flag: 'us',
      },

      title: 'NestJS Guide',
      content:
        '<p>English content</p>',
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
    service.translatePreview(
      3,
      1,
      {
        targetLanguageId: 5,
      },
    ),
  ).rejects.toThrow(BadRequestException);

  expect(
    mockPrismaService.language.findFirst,
  ).toHaveBeenCalledWith({
    where: {
      id: 5,
      deletedAt: null,
      isActive: true,
    },

    select: expect.any(Object),
  });

  expect(
    mockTranslationService.translatePost,
  ).not.toHaveBeenCalled();

  expect(
    mockPrismaService.category.findMany,
  ).not.toHaveBeenCalled();

  expect(
    mockPostsService.create,
  ).not.toHaveBeenCalled();

  expect(
    mockPrismaService.post.update,
  ).not.toHaveBeenCalled();
});

  /**
   * CREATE / RESTORE TRANSLATION
   */

  it('should reject creating translation when target language is inactive', async () => {
  mockPrismaService.post.findFirst.mockResolvedValueOnce({
    id: 1,
    title: 'Bài tiếng Việt',
    content: 'Nội dung tiếng Việt',
    thumbnailUrl: null,

    authorId: 3,
    parentPostId: null,
    languageId: 4,

    postCategories: [
      {
        categoryId: 13,

        category: {
          id: 13,
          categoryGroupId: 5,
        },
      },
    ],

    postTags: [
      {
        postId: 1,
        tagId: 1,
      },
    ],
  });

  mockPrismaService.language.findFirst.mockResolvedValue(null);

  await expect(
    service.translate(
      3,
      1,
      {
        targetLanguageId: 5,
        title: 'English Post',
        content: 'English content',
      },
    ),
  ).rejects.toThrow(BadRequestException);

  expect(
    mockPrismaService.language.findFirst,
  ).toHaveBeenCalledWith({
    where: {
      id: 5,
      deletedAt: null,
      isActive: true,
    },
  });

  /**
   * Phải fail trước khi tìm translation cũ,
   * map category hoặc tạo/update Post.
   */
  expect(
    mockPrismaService.post.findFirst,
  ).toHaveBeenCalledTimes(1);

  expect(
    mockPrismaService.category.findMany,
  ).not.toHaveBeenCalled();

  expect(
    mockPostsService.create,
  ).not.toHaveBeenCalled();

  expect(
    mockPrismaService.post.update,
  ).not.toHaveBeenCalled();
});
  it('should restore a deleted translation instead of creating a new post', async () => {
    mockPrismaService.post.findFirst
      .mockResolvedValueOnce({
        id: 1,
        title:
          'Bài tiếng Việt',
        content:
          'Nội dung tiếng Việt',
        thumbnailUrl: null,

        authorId: 3,
        parentPostId: null,
        languageId: 4,

        postCategories: [
          {
            categoryId: 13,

            category: {
              id: 13,
              categoryGroupId: 5,
            },
          },
        ],

        postTags: [
          {
            postId: 1,
            tagId: 1,
          },
          {
            postId: 1,
            tagId: 2,
          },
        ],
      })

      .mockResolvedValueOnce({
        id: 15,
        title:
          'Old English Post',

        parentPostId: 1,
        authorId: 3,
        languageId: 5,

        status: PostStatus.DRAFT,

        deletedAt: new Date(
          '2026-07-29T08:45:00.000Z',
        ),
      });

    mockPrismaService.language.findFirst
      .mockResolvedValue({
        id: 5,
        code: 'en',
        name: 'English',
        flag: 'us',
      });

    mockPrismaService.category.findMany
      .mockResolvedValue([
        {
          id: 20,
          categoryGroupId: 5,
        },
      ]);

    mockPrismaService.post.update
      .mockResolvedValue({
        id: 15,
      });

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(
        new BlogownerPostEntity({
          id: 15,

          title:
            'Complete Guide to Prisma and NestJS - New',

          content:
            'This is the recreated English translation.',

          status: PostStatus.DRAFT,

          parentPostId: 1,
          authorId: 3,
          languageId: 5,
        }),
      );

    const result =
      await service.translate(
        3,
        1,
        {
          targetLanguageId: 5,

          title:
            'Complete Guide to Prisma and NestJS - New',

          content:
            'This is the recreated English translation.',
        },
      );

    expect(
      mockPrismaService.post.update,
    ).toHaveBeenCalledWith({
      where: {
        id: 15,
      },

      data: {
        title:
          'Complete Guide to Prisma and NestJS - New',

        content:
          'This is the recreated English translation.',

        thumbnailUrl: null,

        status: PostStatus.DRAFT,

        parentPostId: 1,
        languageId: 5,

        deletedAt: null,
        publishedAt: null,

        ...RESET_REVIEW_DATA,

        postCategories: {
          deleteMany: {},

          create: [
            {
              categoryId: 20,
            },
          ],
        },

        postTags: {
          deleteMany: {},

          create: [
            {
              tagId: 1,
            },
            {
              tagId: 2,
            },
          ],
        },
      },
    });

    expect(
      mockPostsService.create,
    ).not.toHaveBeenCalled();

    expect(
      service.findOne,
    ).toHaveBeenCalledWith(
      3,
      15,
    );

    expect(result.id).toBe(15);

    expect(result.status).toBe(
      PostStatus.DRAFT,
    );

    expect(
      result.parentPostId,
    ).toBe(1);

    expect(
      result.languageId,
    ).toBe(5);
  });

  it('should throw conflict when translation already exists and is not deleted', async () => {
    mockPrismaService.post.findFirst
      .mockResolvedValueOnce({
        id: 1,
        title:
          'Bài tiếng Việt',
        content: 'Nội dung',
        thumbnailUrl: null,

        authorId: 3,
        parentPostId: null,
        languageId: 4,

        postCategories: [
          {
            categoryId: 13,

            category: {
              id: 13,
              categoryGroupId: 5,
            },
          },
        ],

        postTags: [
          {
            postId: 1,
            tagId: 1,
          },
        ],
      })

      .mockResolvedValueOnce({
        id: 15,
        parentPostId: 1,
        authorId: 3,
        languageId: 5,
        status: PostStatus.DRAFT,
        deletedAt: null,
      });

    mockPrismaService.language.findFirst
      .mockResolvedValue({
        id: 5,
        code: 'en',
        name: 'English',
        flag: 'us',
      });

    await expect(
      service.translate(
        3,
        1,
        {
          targetLanguageId: 5,
          title:
            'Another English version',
          content:
            'Another content',
        },
      ),
    ).rejects.toThrow(
      new ConflictException(
        'Bài viết đã có phiên bản cho ngôn ngữ được chọn.',
      ),
    );

    expect(
      mockPrismaService.post.update,
    ).not.toHaveBeenCalled();

    expect(
      mockPostsService.create,
    ).not.toHaveBeenCalled();

    expect(
      mockPrismaService.category.findMany,
    ).not.toHaveBeenCalled();
  });

  it('should create a new translation when target language does not exist', async () => {
    mockPrismaService.post.findFirst
      .mockResolvedValueOnce({
        id: 1,

        title:
          'Bài tiếng Việt',

        content:
          'Nội dung tiếng Việt',

        thumbnailUrl: null,

        authorId: 3,
        parentPostId: null,
        languageId: 4,

        postCategories: [
          {
            categoryId: 13,

            category: {
              id: 13,
              categoryGroupId: 5,
            },
          },
        ],

        postTags: [
          {
            postId: 1,
            tagId: 1,
          },
          {
            postId: 1,
            tagId: 2,
          },
        ],
      })

      .mockResolvedValueOnce(null);

    mockPrismaService.language.findFirst
      .mockResolvedValue({
        id: 5,
        code: 'en',
        name: 'English',
        flag: 'us',
      });

    mockPrismaService.category.findMany
      .mockResolvedValue([
        {
          id: 20,
          categoryGroupId: 5,
        },
      ]);

    mockPostsService.create
      .mockResolvedValue({
        id: 16,

        title: 'English Post',

        status: PostStatus.DRAFT,

        parentPostId: 1,
        authorId: 3,
        languageId: 5,
      });

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(
        new BlogownerPostEntity({
          id: 16,

          title:
            'English Post',

          status:
            PostStatus.DRAFT,

          parentPostId: 1,
          authorId: 3,
          languageId: 5,
        }),
      );

    const result =
      await service.translate(
        3,
        1,
        {
          targetLanguageId: 5,
          title:
            'English Post',
          content:
            'English content',
        },
      );

    expect(
      mockPostsService.create,
    ).toHaveBeenCalledWith(
      3,
      {
        title:
          'English Post',

        content:
          'English content',

        thumbnailUrl:
          undefined,

        languageId: 5,

        categoryIds: [20],

        tagIds: [1, 2],

        parentPostId: 1,

        status:
          PostStatus.DRAFT,
      },
    );

    expect(
      mockPrismaService.post.update,
    ).not.toHaveBeenCalled();

    expect(
      service.findOne,
    ).toHaveBeenCalledWith(
      3,
      16,
    );

    expect(result.id).toBe(16);
  });

  /**
 * UPDATE POST
 */

it('should reject an empty update without changing post status', async () => {
  const root = {
    id: 3,
    authorId: 3,
    status: PostStatus.REJECT,
    languageId: 4,
    thumbnailUrl: null,

    rejectionReason:
      'Nội dung chưa đạt yêu cầu.',
  };

  mockHelper.findOwnedPostGroup.mockResolvedValue({
    rootPostId: 3,
    root,
    translations: [],
    posts: [root],
  });

  await expect(
    service.update(
      3,
      3,
      {},
    ),
  ).rejects.toThrow(
    new BadRequestException(
      'Không có dữ liệu nào để cập nhật.',
    ),
  );

  expect(
    mockHelper.assertEditable,
  ).toHaveBeenCalledWith(
    PostStatus.REJECT,
  );

  /**
   * Không được tính trạng thái tiếp theo
   * nếu request thực tế không chỉnh sửa gì.
   */
  expect(
    mockHelper.getNextStatusOnEdit,
  ).not.toHaveBeenCalled();

  expect(
    mockPostsService.update,
  ).not.toHaveBeenCalled();

  expect(
    mockHelper.uploadThumbnail,
  ).not.toHaveBeenCalled();

  expect(
    mockHelper.uploadMediaFiles,
  ).not.toHaveBeenCalled();

  expect(
    mockHelper.resetReviewOnEdit,
  ).not.toHaveBeenCalled();

  expect(
    mockPrismaService.post.update,
  ).not.toHaveBeenCalled();
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
    reviewedAt: new Date(
      '2026-07-30T08:00:00.000Z',
    ),
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
  expect(
    mockPostsService.update,
  ).toHaveBeenCalledWith(
    1,
    expect.objectContaining({
      title: 'Updated published post',
      status: PostStatus.DRAFT,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
    }),
  );

  expect(
    mockHelper.uploadMediaFiles,
  ).toHaveBeenCalledWith(
    1,
    [mediaFile],
  );

  /**
   * Quan trọng nhất:
   * nội dung/status phải được update TRƯỚC khi upload media.
   */
  expect(
    mockPostsService.update.mock
      .invocationCallOrder[0],
  ).toBeLessThan(
    mockHelper.uploadMediaFiles.mock
      .invocationCallOrder[0],
  );

  /**
   * Vì upload media bị lỗi nên không được
   * đi tiếp tới findOne().
   */
  expect(
    mockPrismaService.post.findFirst,
  ).not.toHaveBeenCalled();
});
  /**
   * THUMBNAIL
   */

  it('should upload new thumbnail before deleting old thumbnail', async () => {
    const thumbnailFile = {
      mimetype: 'image/png',
      buffer:
        Buffer.from(
          'fake-image',
        ),
      originalname:
        'new-thumbnail.png',
    } as Express.Multer.File;

    const root = {
      id: 1,
      authorId: 3,

      status:
        PostStatus.DRAFT,

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

    mockCloudinaryService.uploadFile
      .mockResolvedValue({
        secure_url:
          'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

        public_id:
          'nestjs_blog/posts/1/thumbnail/new-thumbnail',
      });

    mockPostsService.update
      .mockResolvedValue({
        id: 1,
      });

    mockHelper.updateOwnedPostGroupStatus
      .mockResolvedValue(undefined);

    mockHelper.uploadMediaFiles
      .mockResolvedValue(undefined);

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(
        new BlogownerPostEntity({
          id: 1,
          status:
            PostStatus.DRAFT,

          thumbnailUrl:
            'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',
        }),
      );

    await service.update(
      3,
      1,
      {
        title:
          'Updated title',
      },
      thumbnailFile,
    );

    expect(
      mockCloudinaryService.uploadFile,
    ).toHaveBeenCalledWith(
      thumbnailFile,
      'nestjs_blog/posts/1/thumbnail',
    );

    expect(
      mockPostsService.update,
    ).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title:
          'Updated title',

        thumbnailUrl:
          'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

        status:
          PostStatus.DRAFT,
      }),
    );

    expect(
      mockCloudinaryService.deleteFile,
    ).toHaveBeenCalledWith(
      'nestjs_blog/posts/1/thumbnail/old-thumbnail',
      'image',
    );

    expect(
      mockCloudinaryService.uploadFile
        .mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockPostsService.update.mock
        .invocationCallOrder[0],
    );

    expect(
      mockPostsService.update.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      mockCloudinaryService.deleteFile
        .mock.invocationCallOrder[0],
    );
  });

  it('should delete newly uploaded thumbnail when database update fails', async () => {
    const thumbnailFile = {
      mimetype: 'image/png',
      buffer:
        Buffer.from(
          'fake-image',
        ),
      originalname:
        'new-thumbnail.png',
    } as Express.Multer.File;

    const root = {
      id: 1,
      authorId: 3,

      status:
        PostStatus.DRAFT,

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

    mockCloudinaryService.uploadFile
      .mockResolvedValue({
        secure_url:
          'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

        public_id:
          'nestjs_blog/posts/1/thumbnail/new-thumbnail',
      });

    mockPostsService.update
      .mockRejectedValue(
        new Error(
          'Database update failed',
        ),
      );

    await expect(
      service.update(
        3,
        1,
        {
          title:
            'Updated title',
        },
        thumbnailFile,
      ),
    ).rejects.toThrow(
      'Database update failed',
    );

    expect(
      mockCloudinaryService.deleteFile,
    ).toHaveBeenCalledWith(
      'nestjs_blog/posts/1/thumbnail/new-thumbnail',
      'image',
    );

    expect(
      mockCloudinaryService.deleteFile,
    ).not.toHaveBeenCalledWith(
      'nestjs_blog/posts/1/thumbnail/old-thumbnail',
      'image',
    );

    expect(
      mockHelper.resetReviewOnEdit,
    ).not.toHaveBeenCalled();
  });

  /**
   * SUBMIT FOR REVIEW
   */

  it('should require a rejected post to be edited before submitting again', async () => {
    const root = {
      id: 3,
      authorId: 3,
      status:
        PostStatus.REJECT,

      rejectionReason:
        'Nội dung chưa đạt yêu cầu.',
    };

    mockHelper.findOwnedPostGroup.mockResolvedValue({
      rootPostId: 3,
      root,
      translations: [],
      posts: [root],
    });

    await expect(
      service.submitForReview(
        3,
        3,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Bài viết bị từ chối phải được chỉnh sửa trước khi gửi duyệt lại.',
      ),
    );

    expect(
      mockHelper.updateOwnedPostGroupStatus,
    ).not.toHaveBeenCalled();
  });

  it('should submit a draft post for review', async () => {
    const root = {
      id: 3,
      authorId: 3,
      status:
        PostStatus.DRAFT,
    };

    mockHelper.findOwnedPostGroup
      .mockResolvedValue({
        rootPostId: 3,
        root,
        translations: [],
        posts: [root],
      });

    mockHelper.updateOwnedPostGroupStatus
      .mockResolvedValue(undefined);

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(
        new BlogownerPostEntity({
          id: 3,
          authorId: 3,

          status:
            PostStatus.PENDING_REVIEW,
        }),
      );

    const result =
      await service.submitForReview(
        3,
        3,
      );

    expect(
      mockHelper.updateOwnedPostGroupStatus,
    ).toHaveBeenCalledWith(
      3,
      3,
      PostStatus.PENDING_REVIEW,
    );

    expect(
      service.findOne,
    ).toHaveBeenCalledWith(
      3,
      3,
    );

    expect(result.status).toBe(
      PostStatus.PENDING_REVIEW,
    );
  });

  /**
   * SYNC ONE TRANSLATION FROM ROOT
   */

  it('should sync a published translation from root and move it to pending review without touching view/like fields', async () => {
    mockHelper.findOwnedPost.mockResolvedValue({
      id: 514,
      authorId: 3,
      parentPostId: 513,
      languageId: 27,
      status: PostStatus.PUBLISH,
      viewCount: 300,
    });

    mockHelper.getNextStatusOnEdit.mockReturnValue(
      PostStatus.PENDING_REVIEW,
    );

    mockPrismaService.language.findFirst.mockResolvedValue({
      id: 27,
      code: 'en',
      name: 'English',
      flag: '🇬🇧',
    });

    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 513,
      title: 'Kiến trúc Angular hiện đại',
      content: '<p>Nội dung mới của bài gốc</p>',
      thumbnailUrl: 'https://example.com/root.jpg',
      language: {
        id: 26,
        code: 'vi',
        name: 'Tiếng Việt',
        flag: '🇻🇳',
      },
      postCategories: [
        {
          category: {
            categoryGroupId: 10,
          },
        },
        {
          category: {
            categoryGroupId: 15,
          },
        },
      ],
      postTags: [
        { tagId: 46 },
        { tagId: 53 },
      ],
    });

    mockPrismaService.category.findMany.mockResolvedValue([
      { id: 110, categoryGroupId: 10 },
      { id: 115, categoryGroupId: 15 },
    ]);

    mockTranslationService.translatePost.mockResolvedValue({
      title: 'Modern Angular Architecture',
      content: '<p>New translated root content</p>',
    });

    mockPrismaService.post.update.mockResolvedValue({
      id: 514,
    });

    jest.spyOn(service, 'findOne').mockResolvedValue(
      new BlogownerPostEntity({
        id: 514,
        title: 'Modern Angular Architecture',
        status: PostStatus.PENDING_REVIEW,
        viewCount: 300,
      }),
    );

    const result = await service.syncFromRoot(3, 514);

    expect(mockHelper.assertEditable).toHaveBeenCalledWith(
      PostStatus.PUBLISH,
    );

    expect(mockTranslationService.translatePost).toHaveBeenCalledWith({
      title: 'Kiến trúc Angular hiện đại',
      content: '<p>Nội dung mới của bài gốc</p>',
      sourceLanguageCode: 'vi',
      targetLanguageCode: 'en',
    });

    expect(mockPrismaService.post.update).toHaveBeenCalledWith({
      where: {
        id: 514,
      },
      data: {
        title: 'Modern Angular Architecture',
        content: '<p>New translated root content</p>',
        thumbnailUrl: 'https://example.com/root.jpg',
        status: PostStatus.PENDING_REVIEW,
        ...RESET_REVIEW_DATA,
        postCategories: {
          deleteMany: {},
          create: [
            { categoryId: 110 },
            { categoryId: 115 },
          ],
        },
        postTags: {
          deleteMany: {},
          create: [
            { tagId: 46 },
            { tagId: 53 },
          ],
        },
      },
    });

    const updateData = mockPrismaService.post.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('viewCount');
    expect(updateData).not.toHaveProperty('postLikes');
    expect(updateData).not.toHaveProperty('media');

    expect(service.findOne).toHaveBeenCalledWith(3, 514);
    expect(result.status).toBe(PostStatus.PENDING_REVIEW);
  });

  it('should reject sync-from-root when the selected post is an original post', async () => {
    mockHelper.findOwnedPost.mockResolvedValue({
      id: 513,
      authorId: 3,
      parentPostId: null,
      languageId: 26,
      status: PostStatus.DRAFT,
    });

    await expect(service.syncFromRoot(3, 513)).rejects.toThrow(
      'Chỉ bản dịch mới có thể đồng bộ từ bài gốc.',
    );

    expect(mockTranslationService.translatePost).not.toHaveBeenCalled();
    expect(mockPrismaService.post.update).not.toHaveBeenCalled();
  });

  it('should not sync a translation that is pending review', async () => {
    mockHelper.findOwnedPost.mockResolvedValue({
      id: 514,
      authorId: 3,
      parentPostId: 513,
      languageId: 27,
      status: PostStatus.PENDING_REVIEW,
    });

    mockHelper.assertEditable.mockImplementation(() => {
      throw new BadRequestException(
        'Bài viết đang chờ Moderator duyệt nên không thể chỉnh sửa.',
      );
    });

    await expect(service.syncFromRoot(3, 514)).rejects.toThrow(
      'Bài viết đang chờ Moderator duyệt nên không thể chỉnh sửa.',
    );

    expect(mockPrismaService.post.findFirst).not.toHaveBeenCalled();
    expect(mockTranslationService.translatePost).not.toHaveBeenCalled();
    expect(mockPrismaService.post.update).not.toHaveBeenCalled();
  });

  it('should validate category mapping before calling the translation service', async () => {
    mockHelper.findOwnedPost.mockResolvedValue({
      id: 514,
      authorId: 3,
      parentPostId: 513,
      languageId: 27,
      status: PostStatus.DRAFT,
    });

    mockPrismaService.language.findFirst.mockResolvedValue({
      id: 27,
      code: 'en',
      name: 'English',
      flag: '🇬🇧',
    });

    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 513,
      title: 'Root',
      content: '<p>Root content</p>',
      thumbnailUrl: null,
      language: {
        id: 26,
        code: 'vi',
        name: 'Tiếng Việt',
        flag: '🇻🇳',
      },
      postCategories: [
        { category: { categoryGroupId: 10 } },
        { category: { categoryGroupId: 15 } },
      ],
      postTags: [],
    });

    /** Chỉ map được một trong hai CategoryGroup. */
    mockPrismaService.category.findMany.mockResolvedValue([
      { id: 110, categoryGroupId: 10 },
    ]);

    await expect(service.syncFromRoot(3, 514)).rejects.toThrow(
      'Một hoặc nhiều danh mục của bài gốc chưa có phiên bản trong ngôn ngữ của bản dịch.',
    );

    expect(mockTranslationService.translatePost).not.toHaveBeenCalled();
    expect(mockPrismaService.post.update).not.toHaveBeenCalled();
  });


  /**
   * SYNC ALL TRANSLATIONS FROM ROOT
   */

  it('should sync all editable translations and skip pending-review translations', async () => {
    mockHelper.findOwnedPost.mockResolvedValue({
      id: 513,
      authorId: 3,
      parentPostId: null,
      status: PostStatus.PENDING_REVIEW,
    });

    mockPrismaService.post.findMany.mockResolvedValue([
      {
        id: 514,
        status: PostStatus.PUBLISH,
        language: { code: 'en' },
      },
      {
        id: 515,
        status: PostStatus.PENDING_REVIEW,
        language: { code: 'fr' },
      },
      {
        id: 516,
        status: PostStatus.DRAFT,
        language: { code: 'ja' },
      },
    ]);

    const syncOneSpy = jest
      .spyOn(service, 'syncFromRoot')
      .mockImplementation(async (_ownerId, translationId) => {
        if (translationId === 514) {
          return new BlogownerPostEntity({
            id: 514,
            status: PostStatus.PENDING_REVIEW,
          });
        }

        return new BlogownerPostEntity({
          id: 516,
          status: PostStatus.DRAFT,
        });
      });

    const result = await service.syncAllTranslations(3, 513);

    expect(mockHelper.findOwnedPost).toHaveBeenCalledWith(3, 513);

    expect(mockPrismaService.post.findMany).toHaveBeenCalledWith({
      where: {
        authorId: 3,
        parentPostId: 513,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        language: {
          select: {
            code: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    /** PENDING_REVIEW #515 phải bị bỏ qua hoàn toàn. */
    expect(syncOneSpy).toHaveBeenCalledTimes(2);
    expect(syncOneSpy).toHaveBeenNthCalledWith(1, 3, 514);
    expect(syncOneSpy).toHaveBeenNthCalledWith(2, 3, 516);
    expect(syncOneSpy).not.toHaveBeenCalledWith(3, 515);

    expect(result).toEqual({
      rootPostId: 513,
      totalTranslations: 3,
      synced: [
        {
          id: 514,
          languageCode: 'en',
          status: PostStatus.PENDING_REVIEW,
        },
        {
          id: 516,
          languageCode: 'ja',
          status: PostStatus.DRAFT,
        },
      ],
      skipped: [
        {
          id: 515,
          languageCode: 'fr',
          status: PostStatus.PENDING_REVIEW,
          reason:
            'Bản dịch đang chờ Moderator duyệt nên không được đồng bộ.',
        },
      ],
      failed: [],
    });
  });

  it('should continue syncing other translations when one translation fails', async () => {
    mockHelper.findOwnedPost.mockResolvedValue({
      id: 513,
      authorId: 3,
      parentPostId: null,
      status: PostStatus.DRAFT,
    });

    mockPrismaService.post.findMany.mockResolvedValue([
      {
        id: 514,
        status: PostStatus.DRAFT,
        language: { code: 'en' },
      },
      {
        id: 516,
        status: PostStatus.REJECT,
        language: { code: 'ja' },
      },
    ]);

    const syncOneSpy = jest
      .spyOn(service, 'syncFromRoot')
      .mockRejectedValueOnce(
        new BadRequestException(
          'Một hoặc nhiều danh mục của bài gốc chưa có phiên bản trong ngôn ngữ của bản dịch.',
        ),
      )
      .mockResolvedValueOnce(
        new BlogownerPostEntity({
          id: 516,
          status: PostStatus.DRAFT,
        }),
      );

    const result = await service.syncAllTranslations(3, 513);

    expect(syncOneSpy).toHaveBeenCalledTimes(2);

    expect(result.synced).toEqual([
      {
        id: 516,
        languageCode: 'ja',
        status: PostStatus.DRAFT,
      },
    ]);

    expect(result.failed).toEqual([
      {
        id: 514,
        languageCode: 'en',
        status: PostStatus.DRAFT,
        reason:
          'Một hoặc nhiều danh mục của bài gốc chưa có phiên bản trong ngôn ngữ của bản dịch.',
      },
    ]);
  });

  it('should reject sync-all-translations when the selected post is a translation', async () => {
    mockHelper.findOwnedPost.mockResolvedValue({
      id: 514,
      authorId: 3,
      parentPostId: 513,
      status: PostStatus.DRAFT,
    });

    await expect(
      service.syncAllTranslations(3, 514),
    ).rejects.toThrow(
      'Chỉ bài gốc mới có thể đồng bộ tất cả bản dịch.',
    );

    expect(mockPrismaService.post.findMany).not.toHaveBeenCalled();
    expect(mockTranslationService.translatePost).not.toHaveBeenCalled();
  });

});