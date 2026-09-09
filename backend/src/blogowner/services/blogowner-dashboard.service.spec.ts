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

    mockPrismaService.post.aggregate.mockResolvedValueOnce({
      _sum: {
        viewCount: 140,
      },
    });

    mockPrismaService.postLike.count.mockResolvedValueOnce(11);

    mockPrismaService.comment.count.mockResolvedValueOnce(7);

    mockPrismaService.postDailyMetric.findMany.mockResolvedValueOnce([
      {
        metricDate: new Date('2026-07-29T00:00:00.000Z'),
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

          updatedAt: new Date('2026-07-29T00:00:00.000Z'),

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

          updatedAt: new Date('2026-07-29T00:00:00.000Z'),

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

    const result = await service.getDashboard(99);

    expect(result.featuredPosts.byViews).toEqual([
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

    expect(result.featuredPosts.byLikes).toEqual([
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

    mockPrismaService.post.aggregate.mockResolvedValueOnce({
      _sum: {
        viewCount: null,
      },
    });

    mockPrismaService.postLike.count.mockResolvedValueOnce(0);

    mockPrismaService.comment.count.mockResolvedValueOnce(0);

    mockPrismaService.postDailyMetric.findMany.mockResolvedValueOnce([]);

    mockPrismaService.post.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.getDashboard(99);

    expect(mockPrismaService.post.findMany).toHaveBeenNthCalledWith(
      1,
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

    expect(mockPrismaService.post.findMany).toHaveBeenNthCalledWith(
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
          {
            id: 'desc',
          },
        ],
      }),
    );
  });
    it('should preserve the legacy dashboard response shape', async () => {
    jest.spyOn(service, 'getSummary').mockResolvedValueOnce({
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

    jest.spyOn(service, 'getActivity').mockResolvedValueOnce({
      days: 7,
      last7Days: [
        {
          date: '2026-07-29',
          views: 20,
          likes: -2,
        },
      ],
    });

    jest.spyOn(service, 'getFeatured')
      .mockResolvedValueOnce({
        sort: 'views',
        posts: [
          {
            id: 101,
            title: 'Top views',
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
      })
      .mockResolvedValueOnce({
        sort: 'likes',
        posts: [
          {
            id: 102,
            title: 'Top likes',
            thumbnailUrl: null,
            status: PostStatus.PUBLISH,
            views: 200,
            likes: 100,
            language: {
              id: 3,
              code: 'ja',
              name: '日本語',
              flag: '🇯🇵',
            },
          },
        ],
      });

    const result = await service.getDashboard(99);

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
      last7Days: [
        {
          date: '2026-07-29',
          views: 20,
          likes: -2,
        },
      ],
      featuredPosts: {
        byViews: [
          {
            id: 101,
            title: 'Top views',
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
        byLikes: [
          {
            id: 102,
            title: 'Top likes',
            thumbnailUrl: null,
            status: PostStatus.PUBLISH,
            views: 200,
            likes: 100,
            language: {
              id: 3,
              code: 'ja',
              name: '日本語',
              flag: '🇯🇵',
            },
          },
        ],
      },
    });

    expect(service.getSummary).toHaveBeenCalledWith(99);
    expect(service.getActivity).toHaveBeenCalledWith(99, 7);
    expect(service.getFeatured).toHaveBeenNthCalledWith(
      1,
      99,
      'views',
      5,
    );
    expect(service.getFeatured).toHaveBeenNthCalledWith(
      2,
      99,
      'likes',
      5,
    );
  });
});
