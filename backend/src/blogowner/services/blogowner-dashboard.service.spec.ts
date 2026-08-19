import { PostStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@app/core';

import { BlogownerDashboardService } from './blogowner-dashboard.service';

describe('BlogownerDashboardService', () => {
  let service: BlogownerDashboardService;

  const mockPrismaService = {
    post: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },

    postLike: {
      count: jest.fn(),
    },

    comment: {
      count: jest.fn(),
    },

    postDailyMetric: {
      findMany: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  beforeAll(() => {
    jest.useFakeTimers();

    /**
     * 10:00 ngày 29/07/2026 tại Việt Nam.
     */
    jest.setSystemTime(
      new Date('2026-07-29T03:00:00.000Z'),
    );
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    /**
     * Prisma transaction dạng mảng:
     * trả kết quả theo đúng thứ tự.
     */
    mockPrismaService.$transaction.mockImplementation(
      async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          BlogownerDashboardService,

          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

    service =
      module.get<BlogownerDashboardService>(
        BlogownerDashboardService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return featured posts by views and likes', async () => {
    /**
     * post.count:
     * 1. total
     * 2. draft
     * 3. pending
     * 4. published
     * 5. rejected
     */
    mockPrismaService.post.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    mockPrismaService.post.aggregate
      .mockResolvedValueOnce({
        _sum: {
          viewCount: 140,
        },
      });

    mockPrismaService.postLike.count
      .mockResolvedValueOnce(11);

    mockPrismaService.comment.count
      .mockResolvedValueOnce(7);

    mockPrismaService.postDailyMetric.findMany
      .mockResolvedValueOnce([
        {
          metricDate: new Date(
            '2026-07-29T00:00:00.000Z',
          ),
          viewCount: 20,
          likeCount: 3,
        },
      ]);

    /**
     * Lần 1: top theo views.
     * Lần 2: top theo likes.
     */
    mockPrismaService.post.findMany
      .mockResolvedValueOnce([
        {
          id: 10,
          title: 'Top view',
          thumbnailUrl: null,
          status: PostStatus.PUBLISH,
          viewCount: 100,

          updatedAt: new Date(
            '2026-07-29T00:00:00.000Z',
          ),

          language: {
            id: 1,
            code: 'vi',
            name: 'Tiếng Việt',
            flag: '🇻🇳',
          },

          _count: {
            postLikes: 3,
          },
        },
      ])

      .mockResolvedValueOnce([
        {
          id: 20,
          title: 'Top like',
          thumbnailUrl: null,
          status: PostStatus.PUBLISH,
          viewCount: 40,

          updatedAt: new Date(
            '2026-07-29T00:00:00.000Z',
          ),

          language: {
            id: 2,
            code: 'en',
            name: 'English',
            flag: '🇺🇸',
          },

          _count: {
            postLikes: 8,
          },
        },
      ]);

    const result =
      await service.getDashboard(99);

    expect(
      result.featuredPosts.byViews,
    ).toEqual([
      {
        id: 10,
        title: 'Top view',
        thumbnailUrl: null,
        status: PostStatus.PUBLISH,
        views: 100,
        likes: 3,

        language: {
          id: 1,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: '🇻🇳',
        },
      },
    ]);

    expect(
      result.featuredPosts.byLikes,
    ).toEqual([
      {
        id: 20,
        title: 'Top like',
        thumbnailUrl: null,
        status: PostStatus.PUBLISH,
        views: 40,
        likes: 8,

        language: {
          id: 2,
          code: 'en',
          name: 'English',
          flag: '🇺🇸',
        },
      },
    ]);
  });

  it('should query at most 5 featured posts', async () => {
    mockPrismaService.post.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrismaService.post.aggregate
      .mockResolvedValueOnce({
        _sum: {
          viewCount: null,
        },
      });

    mockPrismaService.postLike.count
      .mockResolvedValueOnce(0);

    mockPrismaService.comment.count
      .mockResolvedValueOnce(0);

    mockPrismaService.postDailyMetric.findMany
      .mockResolvedValueOnce([]);

    mockPrismaService.post.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.getDashboard(99);

    expect(
      mockPrismaService.post.findMany,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: 5,

        orderBy: [
          {
            viewCount: 'desc',
          },
          {
            updatedAt: 'desc',
          },
        ],
      }),
    );

    expect(
      mockPrismaService.post.findMany,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 5,

        orderBy: [
          {
            postLikes: {
              _count: 'desc',
            },
          },
          {
            viewCount: 'desc',
          },
          {
            updatedAt: 'desc',
          },
        ],
      }),
    );
  });
});