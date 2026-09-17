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
    jest.setSystemTime(new Date('2026-07-29T03:00:00.000Z'));
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
      async (operations: Promise<unknown>[]) => Promise.all(operations),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogownerDashboardService,

        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BlogownerDashboardService>(BlogownerDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

    it('should count root posts but aggregate total interactions from all post versions', async () => {
    mockPrismaService.post.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    mockPrismaService.post.aggregate.mockResolvedValueOnce({
      _sum: {
        viewCount: 450,
      },
    });

    mockPrismaService.postLike.count.mockResolvedValueOnce(80);
    mockPrismaService.comment.count.mockResolvedValueOnce(15);

    const result = await service.getSummary(99);

    expect(result).toEqual({
      postCounts: {
        total: 4,
        draft: 1,
        pendingReview: 1,
        published: 1,
        rejected: 1,
      },
      totals: {
        views: 450,
        likes: 80,
        comments: 15,
      },
    });

    /**
     * Số bài viết trên Dashboard tính theo logical article:
     * chỉ đếm ROOT.
     */
    expect(mockPrismaService.post.count).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          authorId: 99,
          parentPostId: null,
          deletedAt: null,
        },
      },
    );

    /**
     * Nhưng total views tính tất cả version:
     * ROOT + EN + JA + ...
     */
    expect(mockPrismaService.post.aggregate).toHaveBeenCalledWith({
      where: {
        authorId: 99,
        deletedAt: null,
      },
      _sum: {
        viewCount: true,
      },
    });

    expect(mockPrismaService.postLike.count).toHaveBeenCalledWith({
      where: {
        post: {
          authorId: 99,
          deletedAt: null,
        },
      },
    });

    expect(mockPrismaService.comment.count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        post: {
          authorId: 99,
          deletedAt: null,
        },
      },
    });
  });
    it('should aggregate daily activity across all post versions and allow negative like change', async () => {
    mockPrismaService.postDailyMetric.findMany.mockResolvedValueOnce([
      /**
       * 28/07:
       * VI +4 like
       */
      {
        metricDate: new Date('2026-07-28T00:00:00.000Z'),
        viewCount: 10,
        likeCount: 4,
      },

      /**
       * 28/07:
       * EN -6 like
       *
       * Tổng ngày:
       * views = 15
       * likes = -2
       */
      {
        metricDate: new Date('2026-07-28T00:00:00.000Z'),
        viewCount: 5,
        likeCount: -6,
      },

      {
        metricDate: new Date('2026-07-29T00:00:00.000Z'),
        viewCount: 20,
        likeCount: 3,
      },
    ]);

    const result = await service.getActivity(99, 3);

    expect(result).toEqual({
      days: 3,
      last7Days: [
        {
          date: '2026-07-27',
          views: 0,
          likes: 0,
        },
        {
          date: '2026-07-28',
          views: 15,
          likes: -2,
        },
        {
          date: '2026-07-29',
          views: 20,
          likes: 3,
        },
      ],
    });

    expect(
      mockPrismaService.postDailyMetric.findMany,
    ).toHaveBeenCalledWith({
      where: {
        metricDate: {
          gte: new Date('2026-07-27T00:00:00.000Z'),
          lt: new Date('2026-07-30T00:00:00.000Z'),
        },
        post: {
          authorId: 99,
          deletedAt: null,
        },
      },
      select: {
        metricDate: true,
        viewCount: true,
        likeCount: true,
      },
      orderBy: {
        metricDate: 'asc',
      },
    });
  });
    it('should rank exact post versions without restricting featured posts to roots', async () => {
    mockPrismaService.post.findMany.mockResolvedValueOnce([
      {
        id: 101,
        title: 'AI English',
        thumbnailUrl: null,
        status: PostStatus.PUBLISH,
        viewCount: 900,
        updatedAt: new Date('2026-07-29T00:00:00.000Z'),

        language: {
          id: 2,
          code: 'en',
          name: 'English',
          flag: '🇺🇸',
        },

        _count: {
          postLikes: 70,
        },
      },
    ]);

    const result = await service.getFeatured(
      99,
      'views',
      5,
    );

    expect(result).toEqual({
      sort: 'views',
      posts: [
        {
          id: 101,
          title: 'AI English',
          thumbnailUrl: null,
          status: PostStatus.PUBLISH,
          views: 900,
          likes: 70,
          language: {
            id: 2,
            code: 'en',
            name: 'English',
            flag: '🇺🇸',
          },
        },
      ],
    });

    expect(mockPrismaService.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          authorId: 99,
          status: PostStatus.PUBLISH,
          deletedAt: null,
        },
        take: 5,
      }),
    );

    /**
     * Cực kỳ quan trọng:
     * Featured không được quay lại root-only.
     */
    const query =
      mockPrismaService.post.findMany.mock.calls[0][0];

    expect(query.where).not.toHaveProperty('parentPostId');
  });

  it('should rank featured posts by likes with the expected tie breakers', async () => {
    mockPrismaService.post.findMany.mockResolvedValueOnce([
      {
        id: 202,
        title: 'Top likes',
        thumbnailUrl: null,
        status: PostStatus.PUBLISH,
        viewCount: 250,
        updatedAt: new Date('2026-07-29T00:00:00.000Z'),

        language: {
          id: 2,
          code: 'en',
          name: 'English',
          flag: '🇺🇸',
        },

        _count: {
          postLikes: 90,
        },
      },
    ]);

    const result = await service.getFeatured(
      99,
      'likes',
      4,
    );

    expect(result).toEqual({
      sort: 'likes',
      posts: [
        {
          id: 202,
          title: 'Top likes',
          thumbnailUrl: null,
          status: PostStatus.PUBLISH,
          views: 250,
          likes: 90,
          language: {
            id: 2,
            code: 'en',
            name: 'English',
            flag: '🇺🇸',
          },
        },
      ],
    });

    expect(mockPrismaService.post.findMany).toHaveBeenCalledWith({
      where: {
        authorId: 99,
        status: PostStatus.PUBLISH,
        deletedAt: null,
      },

      select: expect.any(Object),

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
        {
          id: 'desc',
        },
      ],

      take: 4,
    });
  });

  it('should use the default featured limit of 5', async () => {
    mockPrismaService.post.findMany.mockResolvedValueOnce([]);

    const result = await service.getFeatured(99);

    expect(result).toEqual({
      sort: 'views',
      posts: [],
    });

    expect(mockPrismaService.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,

        orderBy: [
          {
            viewCount: 'desc',
          },
          {
            postLikes: {
              _count: 'desc',
            },
          },
          {
            updatedAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
      }),
    );
  });
});
