import { PostStatus } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';

import {
  BLOGOWNER_TRANSLATION_JOB,
} from './blogowner-translation.constants';

import { BlogownerTranslationProcessor } from './blogowner-translation.processor';

describe('BlogownerTranslationProcessor', () => {
  let processor: BlogownerTranslationProcessor;

  const mockPrismaService = {
    post: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },

    language: {
      findFirst: jest.fn(),
    },

    category: {
      findMany: jest.fn(),
    },
  };

  const mockLibreTranslateService = {
    translateTexts: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    processor = new BlogownerTranslationProcessor(
      mockPrismaService as any,
      mockLibreTranslateService as any,
    );
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  /**
   * =====================================================
   * TRANSLATE CHILD JOB
   * =====================================================
   */

  it('should translate and upsert one post translation', async () => {
    const sourceUpdatedAt =
      new Date('2026-09-10T02:00:00.000Z');

    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 100,
      authorId: 3,

      parentPostId: null,

      title: 'Hướng dẫn NestJS',
      content: '<p>Nội dung tiếng Việt</p>',

      thumbnailUrl:
        'https://example.com/root-thumbnail.jpg',

      languageId: 4,

      updatedAt: sourceUpdatedAt,

      language: {
        id: 4,
        code: 'vi',
      },

      postCategories: [
        {
          category: {
            categoryGroupId: 10,
          },
        },

        {
          category: {
            categoryGroupId: 20,
          },
        },
      ],

      postTags: [
        {
          tagId: 1,
        },

        {
          tagId: 2,
        },
      ],
    });

    mockPrismaService.language.findFirst.mockResolvedValue({
      id: 5,
      code: 'en',
    });

    mockPrismaService.category.findMany.mockResolvedValue([
      {
        id: 110,
        categoryGroupId: 10,
      },

      {
        id: 120,
        categoryGroupId: 20,
      },
    ]);

    mockLibreTranslateService.translateTexts.mockResolvedValue([
      'NestJS Guide',
      '<p>English content</p>',
    ]);

    mockPrismaService.post.upsert.mockResolvedValue({
      id: 101,
      languageId: 5,
    });

    const job = {
      name:
        BLOGOWNER_TRANSLATION_JOB.TRANSLATE_POST,

      data: {
        rootPostId: 100,
        ownerId: 3,

        sourceLanguageId: 4,
        targetLanguageId: 5,

        sourceUpdatedAt:
          sourceUpdatedAt.toISOString(),
      },

      updateProgress: jest.fn(),
    };

    const result = await processor.process(
      job as any,
    );

    /**
     * Tìm đúng root thuộc Owner.
     */
    expect(
      mockPrismaService.post.findFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 100,
          authorId: 3,

          parentPostId: null,
          deletedAt: null,
        },
      }),
    );

    /**
     * Target language.
     */
    expect(
      mockPrismaService.language.findFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 5,
          deletedAt: null,
        }),
      }),
    );

    /**
     * Category không được dịch bằng AI.
     *
     * Phải map theo cùng CategoryGroup.
     */
    expect(
      mockPrismaService.category.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoryGroupId: {
            in: [10, 20],
          },

          languageId: 5,
          deletedAt: null,
        }),
      }),
    );

    /**
     * Chỉ title + content được gửi sang
     * LibreTranslate.
     */
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
     * Worker phải dùng UPSERT.
     *
     * Nếu BullMQ retry sau khi DB đã ghi thành công,
     * không được tạo duplicate translation.
     */
    expect(
      mockPrismaService.post.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentPostId_languageId: {
            parentPostId: 100,
            languageId: 5,
          },
        },

        update: expect.objectContaining({
          title: 'NestJS Guide',

          content:
            '<p>English content</p>',

          thumbnailUrl:
            'https://example.com/root-thumbnail.jpg',

          status: PostStatus.DRAFT,

          deletedAt: null,
          publishedAt: null,

          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,

          postCategories: {
            deleteMany: {},

            create: [
              {
                categoryId: 110,
              },

              {
                categoryId: 120,
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
        }),

        create: expect.objectContaining({
          title: 'NestJS Guide',

          content:
            '<p>English content</p>',

          thumbnailUrl:
            'https://example.com/root-thumbnail.jpg',

          status: PostStatus.DRAFT,

          authorId: 3,

          parentPostId: 100,
          languageId: 5,

          postCategories: {
            create: [
              {
                categoryId: 110,
              },

              {
                categoryId: 120,
              },
            ],
          },

          postTags: {
            create: [
              {
                tagId: 1,
              },

              {
                tagId: 2,
              },
            ],
          },
        }),
      }),
    );

    expect(job.updateProgress).toHaveBeenNthCalledWith(
      1,
      10,
    );

    expect(job.updateProgress).toHaveBeenNthCalledWith(
      2,
      25,
    );

    expect(job.updateProgress).toHaveBeenNthCalledWith(
      3,
      40,
    );

    expect(job.updateProgress).toHaveBeenNthCalledWith(
      4,
      75,
    );

    expect(job.updateProgress).toHaveBeenNthCalledWith(
      5,
      100,
    );

    expect(result).toEqual({
      postId: 101,
      languageId: 5,
    });
  });

  /**
   * =====================================================
   * STALE JOB
   * =====================================================
   */

  it('should reject a stale translation job when root was edited after enqueue', async () => {
    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 100,
      authorId: 3,

      parentPostId: null,

      title: 'New version',
      content: 'New content',

      languageId: 4,

      /**
       * Root đã thay đổi SAU khi job được enqueue.
       */
      updatedAt: new Date(
        '2026-09-10T03:00:00.000Z',
      ),

      language: {
        id: 4,
        code: 'vi',
      },

      postCategories: [],
      postTags: [],
    });

    const job = {
      name:
        BLOGOWNER_TRANSLATION_JOB.TRANSLATE_POST,

      data: {
        rootPostId: 100,
        ownerId: 3,

        sourceLanguageId: 4,
        targetLanguageId: 5,

        /**
         * Job cũ.
         */
        sourceUpdatedAt:
          '2026-09-10T02:00:00.000Z',
      },

      updateProgress: jest.fn(),
    };

    await expect(
      processor.process(job as any),
    ).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    /**
     * Phải dừng trước LibreTranslate.
     */
    expect(
      mockPrismaService.language.findFirst,
    ).not.toHaveBeenCalled();

    expect(
      mockLibreTranslateService.translateTexts,
    ).not.toHaveBeenCalled();

    expect(
      mockPrismaService.post.upsert,
    ).not.toHaveBeenCalled();
  });

  /**
   * =====================================================
   * CATEGORY VALIDATION
   * =====================================================
   */

  it('should fail permanently when a target category translation is missing', async () => {
    const sourceUpdatedAt =
      new Date('2026-09-10T02:00:00.000Z');

    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 100,
      authorId: 3,

      parentPostId: null,

      title: 'Root',
      content: '<p>Root content</p>',

      thumbnailUrl: null,

      languageId: 4,
      updatedAt: sourceUpdatedAt,

      language: {
        id: 4,
        code: 'vi',
      },

      /**
       * Root có 2 category group.
       */
      postCategories: [
        {
          category: {
            categoryGroupId: 10,
          },
        },

        {
          category: {
            categoryGroupId: 20,
          },
        },
      ],

      postTags: [],
    });

    mockPrismaService.language.findFirst.mockResolvedValue({
      id: 5,
      code: 'en',
    });

    /**
     * Nhưng EN chỉ map được CategoryGroup 10.
     *
     * Group 20 chưa có bản dịch.
     */
    mockPrismaService.category.findMany.mockResolvedValue([
      {
        id: 110,
        categoryGroupId: 10,
      },
    ]);

    const job = {
      name:
        BLOGOWNER_TRANSLATION_JOB.TRANSLATE_POST,

      data: {
        rootPostId: 100,
        ownerId: 3,

        sourceLanguageId: 4,
        targetLanguageId: 5,

        sourceUpdatedAt:
          sourceUpdatedAt.toISOString(),
      },

      updateProgress: jest.fn(),
    };

    await expect(
      processor.process(job as any),
    ).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    /**
     * Category lỗi business-rule thì
     * không được gọi LibreTranslate.
     */
    expect(
      mockLibreTranslateService.translateTexts,
    ).not.toHaveBeenCalled();

    expect(
      mockPrismaService.post.upsert,
    ).not.toHaveBeenCalled();
  });

  /**
   * =====================================================
   * FINALIZE → PENDING_REVIEW
   * =====================================================
   */

  it('should move the entire group to pending review after all translations succeed', async () => {
    const sourceUpdatedAt =
      new Date('2026-09-10T02:00:00.000Z');

    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 100,
      updatedAt: sourceUpdatedAt,
    });

    mockPrismaService.post.updateMany.mockResolvedValue({
      count: 3,
    });

    const job = {
      name:
        BLOGOWNER_TRANSLATION_JOB.FINALIZE_BATCH,

      data: {
        rootPostId: 100,
        ownerId: 3,

        sourceUpdatedAt:
          sourceUpdatedAt.toISOString(),

        submitForReview: true,
      },

      updateProgress: jest.fn(),
    };

    const result = await processor.process(
      job as any,
    );

    expect(
      mockPrismaService.post.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        id: 100,
        authorId: 3,

        parentPostId: null,
        deletedAt: null,
      },

      select: {
        id: true,
        updatedAt: true,
      },
    });

    /**
     * Root + tất cả translations.
     */
    expect(
      mockPrismaService.post.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        authorId: 3,
        deletedAt: null,

        OR: [
          {
            id: 100,
            parentPostId: null,
          },

          {
            parentPostId: 100,
          },
        ],
      },

      data: {
        status: PostStatus.PENDING_REVIEW,

        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    });

    expect(job.updateProgress).toHaveBeenNthCalledWith(
      1,
      20,
    );

    expect(job.updateProgress).toHaveBeenNthCalledWith(
      2,
      60,
    );

    expect(job.updateProgress).toHaveBeenNthCalledWith(
      3,
      100,
    );

    expect(result).toEqual({
      rootPostId: 100,
      status: PostStatus.PENDING_REVIEW,
    });
  });

  /**
   * =====================================================
   * FINALIZE → DRAFT
   * =====================================================
   */

  it('should keep the entire group as draft when submitForReview is false', async () => {
    const sourceUpdatedAt =
      new Date('2026-09-10T02:00:00.000Z');

    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 100,
      updatedAt: sourceUpdatedAt,
    });

    mockPrismaService.post.updateMany.mockResolvedValue({
      count: 3,
    });

    const job = {
      name:
        BLOGOWNER_TRANSLATION_JOB.FINALIZE_BATCH,

      data: {
        rootPostId: 100,
        ownerId: 3,

        sourceUpdatedAt:
          sourceUpdatedAt.toISOString(),

        submitForReview: false,
      },

      updateProgress: jest.fn(),
    };

    const result = await processor.process(
      job as any,
    );

    expect(
      mockPrismaService.post.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: PostStatus.DRAFT,

          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      }),
    );

    expect(result).toEqual({
      rootPostId: 100,
      status: PostStatus.DRAFT,
    });
  });

  /**
   * =====================================================
   * STALE FINALIZER
   * =====================================================
   */

  it('should reject an old finalize job when the root has been edited again', async () => {
    mockPrismaService.post.findFirst.mockResolvedValue({
      id: 100,

      updatedAt: new Date(
        '2026-09-10T04:00:00.000Z',
      ),
    });

    const job = {
      name:
        BLOGOWNER_TRANSLATION_JOB.FINALIZE_BATCH,

      data: {
        rootPostId: 100,
        ownerId: 3,

        sourceUpdatedAt:
          '2026-09-10T02:00:00.000Z',

        submitForReview: true,
      },

      updateProgress: jest.fn(),
    };

    await expect(
      processor.process(job as any),
    ).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(
      mockPrismaService.post.updateMany,
    ).not.toHaveBeenCalled();
  });

  /**
   * =====================================================
   * UNKNOWN JOB
   * =====================================================
   */

  it('should reject an unsupported job name', async () => {
    const job = {
      name: 'unknown-job',

      data: {},

      updateProgress: jest.fn(),
    };

    await expect(
      processor.process(job as any),
    ).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});