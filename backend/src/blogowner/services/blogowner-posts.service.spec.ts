import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import {
  CloudinaryService,
  MediaService,
  PostsService,
  PrismaService,
} from '@app/core';

import { BlogownerPostEntity } from '../entities';
import { BlogownerPostHelperService } from './blogowner-post-helper.service';
import { BlogownerPostsService } from './blogowner-posts.service';

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
    assertEditable: jest.fn(),
    assertSubmittable: jest.fn(),
    getNextStatusOnEdit: jest.fn(),
    resetReviewOnEdit: jest.fn(),
    uploadThumbnail: jest.fn(),
    uploadMediaFiles: jest.fn(),
    deleteOldThumbnail: jest.fn(),
  };

  const mockMediaService = {};

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockHelper.uploadThumbnail.mockImplementation((postId, file) =>
      mockCloudinaryService.uploadFile(
        file,
        `nestjs_blog/posts/${postId}/thumbnail`,
      ),
    );

    mockHelper.deleteOldThumbnail.mockImplementation((url) => {
      if (url && url.includes('/upload/')) {
        const parts = url.split('/upload/');
        if (parts.length > 1) {
          let path = parts[1].replace(/^v\d+\//, '');
          const publicId = path.substring(0, path.lastIndexOf('.')) || path;
          return mockCloudinaryService.deleteFile(publicId, 'image');
        }
      }
    });

    mockHelper.assertSubmittable.mockImplementation((status: PostStatus) => {
      if (status !== PostStatus.DRAFT) {
        const statusErrors: Record<string, string> = {
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
      }
    });

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
            provide: BlogownerPostHelperService,
            useValue: mockHelper,
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

    service = module.get<BlogownerPostsService>(
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
   * Bước 2:
   * Nếu đang xem một bản dịch EN,
   * backend phải tìm root post rồi trả toàn bộ group EN + VI.
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

    /**
     * Phải lấy đúng bài của owner.
     */
    expect(
      mockHelper.findOwnedPost,
    ).toHaveBeenCalledWith(
      99,
      15,
      expect.any(Object),
    );

    /**
     * Vì post 15 có parentPostId = 1
     * nên rootPostId phải bằng 1.
     */
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
   * Bước 3:
   * Nếu translation từng bị soft-delete thì
   * restore record cũ thay vì tạo post mới.
   */
  it('should restore a deleted translation instead of creating a new post', async () => {
    /**
     * Lần findFirst thứ nhất:
     * bài nguồn VI.
     */
    mockPrismaService.post.findFirst
      .mockResolvedValueOnce({
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
          {
            postId: 1,
            tagId: 2,
          },
        ],
      })

      /**
       * Lần findFirst thứ hai:
       * EN #15 đã bị soft-delete.
       */
      .mockResolvedValueOnce({
        id: 15,
        title: 'Old English Post',

        parentPostId: 1,
        authorId: 3,
        languageId: 5,

        status: PostStatus.DRAFT,

        deletedAt: new Date(
          '2026-07-29T08:45:00.000Z',
        ),
      });

    /**
     * Ngôn ngữ EN tồn tại.
     */
    mockPrismaService.language.findFirst.mockResolvedValue({
      id: 5,
      code: 'en',
      name: 'English',
      flag: 'us',
    });

    /**
     * Category tương ứng của EN.
     */
    mockPrismaService.category.findMany.mockResolvedValue([
      {
        id: 20,
        categoryGroupId: 5,
      },
    ]);

    mockPrismaService.post.update.mockResolvedValue({
      id: 15,
    });

    /**
     * translate() cuối cùng gọi findOne()
     * để trả post đã restore.
     *
     * Mock findOne để test này chỉ tập trung
     * vào nghiệp vụ restore.
     */
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

    const result = await service.translate(
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

    /**
     * Phải UPDATE #15,
     * không CREATE post mới.
     */
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
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,

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

    /**
     * Không được tạo record mới.
     */
    expect(
      mockPostsService.create,
    ).not.toHaveBeenCalled();

    /**
     * Sau restore phải lấy lại detail #15.
     */
    expect(service.findOne).toHaveBeenCalledWith(
      3,
      15,
    );

    expect(result.id).toBe(15);
    expect(result.status).toBe(
      PostStatus.DRAFT,
    );
    expect(result.parentPostId).toBe(1);
    expect(result.languageId).toBe(5);
  });

  /**
   * Nếu translation EN đang tồn tại,
   * không được tạo thêm một EN khác.
   */
  it('should throw conflict when translation already exists and is not deleted', async () => {
    mockPrismaService.post.findFirst
      /**
       * Source VI.
       */
      .mockResolvedValueOnce({
        id: 1,
        title: 'Bài tiếng Việt',
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

      /**
       * EN đang tồn tại.
       */
      .mockResolvedValueOnce({
        id: 15,

        parentPostId: 1,
        authorId: 3,
        languageId: 5,

        status: PostStatus.DRAFT,

        deletedAt: null,
      });

    mockPrismaService.language.findFirst.mockResolvedValue({
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
          title: 'Another English version',
          content: 'Another content',
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

  /**
   * Nếu chưa từng có bản EN thì
   * vẫn phải tạo một post mới bình thường.
   */
  it('should create a new translation when target language does not exist', async () => {
    mockPrismaService.post.findFirst
      /**
       * Source VI.
       */
      .mockResolvedValueOnce({
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
          {
            postId: 1,
            tagId: 2,
          },
        ],
      })

      /**
       * Chưa từng có EN.
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
        id: 20,
        categoryGroupId: 5,
      },
    ]);

    mockPostsService.create.mockResolvedValue({
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

          title: 'English Post',

          status: PostStatus.DRAFT,

          parentPostId: 1,
          authorId: 3,
          languageId: 5,
        }),
      );

    const result = await service.translate(
      3,
      1,
      {
        targetLanguageId: 5,
        title: 'English Post',
        content: 'English content',
      },
    );

    expect(
      mockPostsService.create,
    ).toHaveBeenCalledWith(
      3,
      {
        title: 'English Post',
        content: 'English content',

        thumbnailUrl: undefined,

        languageId: 5,

        categoryIds: [20],

        tagIds: [1, 2],

        parentPostId: 1,

        status: PostStatus.DRAFT,
      },
    );

    expect(
      mockPrismaService.post.update,
    ).not.toHaveBeenCalled();

    expect(service.findOne).toHaveBeenCalledWith(
      3,
      16,
    );

    expect(result.id).toBe(16);
  });

  it('should upload new thumbnail before deleting old thumbnail', async () => {
  const thumbnailFile = {
    mimetype: 'image/png',
    buffer: Buffer.from('fake-image'),
    originalname: 'new-thumbnail.png',
  } as Express.Multer.File;

  mockHelper.findOwnedPost.mockResolvedValue({
    id: 1,
    authorId: 3,

    status: PostStatus.DRAFT,

    thumbnailUrl:
      'https://res.cloudinary.com/demo/image/upload/v123/nestjs_blog/posts/1/thumbnail/old-thumbnail.png',
  });

  mockHelper.getNextStatusOnEdit.mockReturnValue(
    PostStatus.DRAFT,
  );

  mockCloudinaryService.uploadFile.mockResolvedValue({
    secure_url:
      'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

    public_id:
      'nestjs_blog/posts/1/thumbnail/new-thumbnail',
  });

  mockPostsService.update.mockResolvedValue({
    id: 1,
  });

  mockHelper.resetReviewOnEdit.mockResolvedValue(
    undefined,
  );

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
      title: 'Updated title',

      thumbnailUrl:
        'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

      status: PostStatus.DRAFT,
    }),
  );

  /**
   * Thumbnail cũ phải được xóa.
   */
  expect(
    mockCloudinaryService.deleteFile,
  ).toHaveBeenCalledWith(
    'nestjs_blog/posts/1/thumbnail/old-thumbnail',
    'image',
  );

  /**
   * Quan trọng:
   * upload phải xảy ra trước DB update.
   */
  expect(
    mockCloudinaryService.uploadFile.mock
      .invocationCallOrder[0],
  ).toBeLessThan(
    mockPostsService.update.mock
      .invocationCallOrder[0],
  );

  /**
   * DB update phải thành công trước khi xóa ảnh cũ.
   */
  expect(
    mockPostsService.update.mock
      .invocationCallOrder[0],
  ).toBeLessThan(
    mockCloudinaryService.deleteFile.mock
      .invocationCallOrder[0],
  );
});
it('should delete newly uploaded thumbnail when database update fails', async () => {
  const thumbnailFile = {
    mimetype: 'image/png',
    buffer: Buffer.from('fake-image'),
    originalname: 'new-thumbnail.png',
  } as Express.Multer.File;

  const oldThumbnailUrl =
    'https://res.cloudinary.com/demo/image/upload/v123/nestjs_blog/posts/1/thumbnail/old-thumbnail.png';

  mockHelper.findOwnedPost.mockResolvedValue({
    id: 1,
    authorId: 3,

    status: PostStatus.DRAFT,

    thumbnailUrl: oldThumbnailUrl,
  });

  mockHelper.getNextStatusOnEdit.mockReturnValue(
    PostStatus.DRAFT,
  );

  mockCloudinaryService.uploadFile.mockResolvedValue({
    secure_url:
      'https://res.cloudinary.com/demo/image/upload/v456/nestjs_blog/posts/1/thumbnail/new-thumbnail.png',

    public_id:
      'nestjs_blog/posts/1/thumbnail/new-thumbnail',
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
  ).rejects.toThrow(
    'Database update failed',
  );

  /**
   * Ảnh mới phải được cleanup.
   */
  expect(
    mockCloudinaryService.deleteFile,
  ).toHaveBeenCalledWith(
    'nestjs_blog/posts/1/thumbnail/new-thumbnail',
    'image',
  );

  /**
   * Không được xóa thumbnail cũ.
   *
   * Nếu code sai thứ tự thì sẽ có call xóa
   * old-thumbnail.
   */
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

    it('should require a rejected post to be edited before submitting again', async () => {
  mockHelper.findOwnedPost.mockResolvedValue({
    id: 3,
    authorId: 3,
    status: PostStatus.REJECT,
    rejectionReason: 'Nội dung chưa đạt yêu cầu.',
  });

  await expect(
    service.submitForReview(3, 3),
  ).rejects.toThrow(
    new BadRequestException(
      'Bài viết bị từ chối phải được chỉnh sửa trước khi gửi duyệt lại.',
    ),
  );

  expect(
    mockPrismaService.post.update,
  ).not.toHaveBeenCalled();
});

    it('should submit a draft post for review', async () => {
  mockHelper.findOwnedPost.mockResolvedValue({
    id: 3,
    authorId: 3,
    status: PostStatus.DRAFT,
  });

  mockPrismaService.post.update.mockResolvedValue({
    id: 3,
    status: PostStatus.PENDING_REVIEW,
  });

  jest
    .spyOn(service, 'findOne')
    .mockResolvedValue(
      new BlogownerPostEntity({
        id: 3,
        authorId: 3,
        status: PostStatus.PENDING_REVIEW,
      }),
    );

  const result = await service.submitForReview(
    3,
    3,
  );

  expect(
    mockPrismaService.post.update,
  ).toHaveBeenCalledWith({
    where: {
      id: 3,
    },

    data: {
      status: PostStatus.PENDING_REVIEW,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
    },
  });

  expect(service.findOne).toHaveBeenCalledWith(
    3,
    3,
  );

  expect(result.status).toBe(
    PostStatus.PENDING_REVIEW,
  );
});
});