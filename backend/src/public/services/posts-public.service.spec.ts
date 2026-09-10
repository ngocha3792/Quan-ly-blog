import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PostsPublicService } from './posts-public.service';
import {
  PrismaService,
  PostsService,
  LanguagesService,
  JWTUtil,
} from '@app/core';
import { PostStatus, Prisma } from '@prisma/client';

describe('PostsPublicService', () => {
  let service: PostsPublicService;

const mockPrismaService = {
  post: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  postViewLog: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  postDailyMetric: {
    upsert: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

  const mockPostsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    incrementViewCount: jest.fn(),
  };

  const mockLanguagesService = {
    getActiveIdByCode: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockJwtUtil = {
    verifyAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'app.viewerKeySecret') {
        return 'test-viewer-key-secret';
      }
      if (key === 'app.topPostsCandidateDays') {
        return 90;
      }
      if (key === 'app.topPostsCacheTtlSeconds') {
        return 120;
      }
      return undefined;
    });

    mockPrismaService.$transaction.mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(mockPrismaService);
      }
      return cb;
    });

    /**
     * post.viewCount trả về được tính bằng getGroupViewCount() (SUM view
     * của root + translations), gọi vô điều kiện ở cuối findOne(). Mặc
     * định 0 — test nào cần số cụ thể sẽ override bằng mockResolvedValueOnce.
     */
    mockPrismaService.post.aggregate.mockResolvedValue({
      _sum: { viewCount: 0 },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsPublicService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PostsService, useValue: mockPostsService },
        { provide: LanguagesService, useValue: mockLanguagesService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JWTUtil, useValue: mockJwtUtil },
      ],
    }).compile();

    service = module.get<PostsPublicService>(PostsPublicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return empty result when requested language is not public', async () => {
      mockLanguagesService.getActiveIdByCode.mockResolvedValueOnce(undefined);

      const query = {};

      const pagination = {
        page: 1,
        skip: 0,
        take: 10,
      };

      const result = await service.findAll(query, pagination, 'ja');

      expect(result).toEqual({
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 10,
          totalPages: 0,
          currentPage: 1,
        },
      });

      expect(mockPostsService.findAll).not.toHaveBeenCalled();
    });

    it('should resolve active language code before querying public posts', async () => {
      mockLanguagesService.getActiveIdByCode.mockResolvedValueOnce(2);

      mockPostsService.findAll.mockResolvedValueOnce({
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 10,
          totalPages: 0,
          currentPage: 1,
        },
      });

      const query: any = {};

      await service.findAll(
        query,
        {
          page: 1,
          skip: 0,
          take: 10,
        },
        'en',
      );

      expect(query.languageId).toBe(2);

      expect(mockLanguagesService.getActiveIdByCode).toHaveBeenCalledWith('en');

      expect(mockPostsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          languageId: 2,
          status: PostStatus.PUBLISH,
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        {
          language: {
            is: {
              isActive: true,
              deletedAt: null,
            },
          },
        },
      );
    });
  });

  describe('findOne', () => {
  it('should require the post language to be active and non-deleted', async () => {
    mockPostsService.findOne.mockResolvedValueOnce({
      id: 1,
      title: 'Test Post',
      status: PostStatus.PUBLISH,
      languageId: 1,
    });

    const result = await service.findOne(1, null);

    expect(result.id).toBe(1);

    expect(mockPostsService.findOne).toHaveBeenCalledWith(
      1,
      expect.anything(),
      {
        language: {
          is: {
            isActive: true,
            deletedAt: null,
          },
        },
      },
    );
  });

  it('should not record a view when merely fetching post detail', async () => {
    mockPostsService.findOne.mockResolvedValueOnce({
      id: 1,
      title: 'Test Post',
      status: PostStatus.PUBLISH,
      languageId: 1,
      viewCount: 10,
    });

    /**
     * viewCount trả về là tổng cả nhóm (getGroupViewCount), không phải
     * viewCount thô 10 của riêng bản ghi này — xem test
     * "should return the group total..." bên dưới cho chi tiết vì sao.
     */
    mockPrismaService.post.aggregate.mockResolvedValueOnce({
      _sum: { viewCount: 42 },
    });

    const result = await service.findOne(1, null);

    expect(result.id).toBe(1);
    expect(result.viewCount).toBe(42);

    expect(mockJwtUtil.verifyAccessToken).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    expect(mockPrismaService.postViewLog.findFirst).not.toHaveBeenCalled();
    expect(mockPrismaService.postViewLog.create).not.toHaveBeenCalled();
    expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    expect(mockPrismaService.postDailyMetric.upsert).not.toHaveBeenCalled();
  });

  it('should return the group total (root + all translations) as viewCount, not just the exact version read', async () => {
    /**
     * Bug đã gặp thật: chỉ trả viewCount thô của đúng bản ghi đang đọc
     * (recordView() tăng riêng từng bản dịch) khiến người đọc chuyển
     * ngôn ngữ thấy view "biến mất" — vì phần lớn lịch sử view đã dồn
     * vào ROOT từ hồi còn tính view theo kiểu cũ. findOne() phải luôn
     * trả về TỔNG cả nhóm ngôn ngữ.
     */
    mockPostsService.findOne.mockResolvedValueOnce({
      id: 12,
      parentPostId: 10,
      title: 'Bản dịch tiếng Nhật',
      status: PostStatus.PUBLISH,
      languageId: 3,
      viewCount: 2,
    });

    mockPrismaService.post.aggregate.mockResolvedValueOnce({
      _sum: { viewCount: 137 },
    });

    const result = await service.findOne(12, null);

    expect(result.viewCount).toBe(137);

    expect(mockPrismaService.post.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { id: 10, parentPostId: null },
            { parentPostId: 10 },
          ],
        }),
      }),
    );
  });
});

describe('recordView', () => {
  const visitorId = '550e8400-e29b-41d4-a716-446655440000';

  it('should record a guest view for the exact post version and daily metric', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 101,
    });

    mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce(null);

    mockPrismaService.postViewLog.create.mockResolvedValueOnce({
      id: 1,
    });

    mockPrismaService.post.update.mockResolvedValueOnce({
      id: 101,
      viewCount: 11,
    });

    mockPrismaService.postDailyMetric.upsert.mockResolvedValueOnce({
      id: 1,
    });

    mockPrismaService.post.findUnique.mockResolvedValueOnce({
      viewCount: 11,
    });

    const result = await service.recordView(
      101,
      visitorId,
      null,
    );

    const expectedViewerKey = `v3:${createHmac(
      'sha256',
      'test-viewer-key-secret',
    )
      .update(['post:101', `guest:${visitorId}`].join('\n'))
      .digest('hex')}`;

    expect(result).toEqual({
      counted: true,
      viewCount: 11,
    });

    expect(mockPrismaService.postViewLog.findFirst).toHaveBeenCalledWith({
      where: {
        postId: 101,
        viewerKey: expectedViewerKey,
        viewedAt: {
          gte: expect.any(Date),
        },
      },
      select: {
        id: true,
      },
    });

    expect(mockPrismaService.postViewLog.create).toHaveBeenCalledWith({
      data: {
        postId: 101,
        viewerKey: expectedViewerKey,
      },
    });

    expect(mockPrismaService.post.update).toHaveBeenCalledWith({
      where: {
        id: 101,
      },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });

    expect(mockPrismaService.postDailyMetric.upsert).toHaveBeenCalledWith({
      where: {
        postId_metricDate: {
          postId: 101,
          metricDate: expect.any(Date),
        },
      },
      create: {
        postId: 101,
        metricDate: expect.any(Date),
        viewCount: 1,
        likeCount: 0,
      },
      update: {
        viewCount: {
          increment: 1,
        },
      },
    });
  });

  it('should use account id instead of visitorId when access token is valid', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 101,
    });

    mockJwtUtil.verifyAccessToken.mockReturnValueOnce({
      sub: '42',
    });

    mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce(null);
    mockPrismaService.postViewLog.create.mockResolvedValueOnce({ id: 1 });
    mockPrismaService.post.update.mockResolvedValueOnce({
      id: 101,
      viewCount: 20,
    });
    mockPrismaService.postDailyMetric.upsert.mockResolvedValueOnce({
      id: 1,
    });
    mockPrismaService.post.findUnique.mockResolvedValueOnce({
      viewCount: 20,
    });

    const result = await service.recordView(
      101,
      visitorId,
      'Bearer some-valid-token',
    );

    const expectedViewerKey = `v3:${createHmac(
      'sha256',
      'test-viewer-key-secret',
    )
      .update(['post:101', 'user:42'].join('\n'))
      .digest('hex')}`;

    expect(mockJwtUtil.verifyAccessToken).toHaveBeenCalledWith(
      'some-valid-token',
    );

    expect(mockPrismaService.postViewLog.create).toHaveBeenCalledWith({
      data: {
        postId: 101,
        viewerKey: expectedViewerKey,
      },
    });

    expect(result).toEqual({
      counted: true,
      viewCount: 20,
    });
  });

  it('should fall back to visitorId when Bearer token is invalid', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 101,
    });

    mockJwtUtil.verifyAccessToken.mockImplementationOnce(() => {
      throw new Error('invalid token');
    });

    mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce(null);
    mockPrismaService.postViewLog.create.mockResolvedValueOnce({ id: 1 });
    mockPrismaService.post.update.mockResolvedValueOnce({
      id: 101,
      viewCount: 5,
    });
    mockPrismaService.postDailyMetric.upsert.mockResolvedValueOnce({
      id: 1,
    });
    mockPrismaService.post.findUnique.mockResolvedValueOnce({
      viewCount: 5,
    });

    await service.recordView(
      101,
      visitorId,
      'Bearer bad-token',
    );

    const expectedViewerKey = `v3:${createHmac(
      'sha256',
      'test-viewer-key-secret',
    )
      .update(['post:101', `guest:${visitorId}`].join('\n'))
      .digest('hex')}`;

    expect(mockPrismaService.postViewLog.create).toHaveBeenCalledWith({
      data: {
        postId: 101,
        viewerKey: expectedViewerKey,
      },
    });
  });

  it('should not increment again when the same viewer viewed the same post within 10 minutes', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 101,
    });

    mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce({
      id: 99,
    });

    mockPrismaService.post.findUnique.mockResolvedValueOnce({
      viewCount: 10,
    });

    const beforeRequest = Date.now();

    const result = await service.recordView(
      101,
      visitorId,
      null,
    );

    expect(result).toEqual({
      counted: false,
      viewCount: 10,
    });

    const findViewCall =
      mockPrismaService.postViewLog.findFirst.mock.calls[0][0];

    const viewedAfter =
      findViewCall.where.viewedAt.gte as Date;

    /**
     * Threshold phải xấp xỉ now - 10 phút.
     */
    expect(viewedAfter.getTime()).toBeGreaterThanOrEqual(
      beforeRequest - 10 * 60 * 1000 - 1000,
    );

    expect(viewedAfter.getTime()).toBeLessThanOrEqual(
      Date.now() - 10 * 60 * 1000 + 1000,
    );

    expect(mockPrismaService.postViewLog.create).not.toHaveBeenCalled();
    expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    expect(mockPrismaService.postDailyMetric.upsert).not.toHaveBeenCalled();
  });

  it('should not store raw visitor data when VIEWER_KEY_SECRET is missing', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'app.viewerKeySecret') {
        return undefined;
      }

      return undefined;
    });

    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 101,
    });

    mockPrismaService.post.findUnique.mockResolvedValueOnce({
      viewCount: 7,
    });

    const result = await service.recordView(
      101,
      visitorId,
      null,
    );

    expect(result).toEqual({
      counted: false,
      viewCount: 7,
    });

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    expect(mockPrismaService.postViewLog.create).not.toHaveBeenCalled();
    expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    expect(mockPrismaService.postDailyMetric.upsert).not.toHaveBeenCalled();
  });
});

  describe('getTopPosts', () => {
    it('should reuse cached ranking ids instead of aggregating again', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([
        { id: 3 },
        { id: 2 },
        { id: 1 },
      ]);

      mockPrismaService.post.findMany.mockResolvedValue([
        { id: 1, title: 'Post 1', status: PostStatus.PUBLISH },
        { id: 2, title: 'Post 2', status: PostStatus.PUBLISH },
        { id: 3, title: 'Post 3', status: PostStatus.PUBLISH },
      ]);

      const firstResult = await service.getTopPosts(2, null);
      const secondResult = await service.getTopPosts(2, null);

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.post.findMany).toHaveBeenCalledTimes(2);
      expect(firstResult.map((post) => post.id)).toEqual([3, 2]);
      expect(secondResult.map((post) => post.id)).toEqual([3, 2]);
    });

    it('should reuse the same cached ranking for different limits', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([
        { id: 5 },
        { id: 4 },
        { id: 3 },
        { id: 2 },
        { id: 1 },
      ]);

      mockPrismaService.post.findMany.mockImplementation(async ({ where }) => {
        const ids = where.id.in;
        return ids.map((id: number) => ({
          id,
          title: `Post ${id}`,
          status: PostStatus.PUBLISH,
        }));
      });

      const topTwo = await service.getTopPosts(2, null);
      const topFive = await service.getTopPosts(5, null);

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
      expect(topTwo.map((post) => post.id)).toEqual([5, 4]);
      expect(topFive.map((post) => post.id)).toEqual([5, 4, 3, 2, 1]);
    });

    it('should cache rankings separately for each language', async () => {
      mockLanguagesService.getActiveIdByCode.mockImplementation(
        async (code: string) => {
          if (code === 'vi') return 1;
          if (code === 'en') return 2;
          return undefined;
        },
      );

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }]);

      mockPrismaService.post.findMany.mockImplementation(async ({ where }) =>
        where.id.in.map((id: number) => ({
          id,
          title: `Post ${id}`,
          status: PostStatus.PUBLISH,
        })),
      );

      await service.getTopPosts(10, 'vi');
      await service.getTopPosts(10, 'en');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);

      await service.getTopPosts(10, 'vi');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should not run ranking query for an inactive language', async () => {
      mockLanguagesService.getActiveIdByCode.mockResolvedValueOnce(undefined);

      const result = await service.getTopPosts(10, 'ja');

      expect(result).toEqual([]);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
      expect(mockPrismaService.post.findMany).not.toHaveBeenCalled();
    });
  });

describe('buildViewerKey', () => {
  const visitorId = '550e8400-e29b-41d4-a716-446655440000';

  it('should produce different keys for the same guest on different post versions', () => {
    const firstKey = (service as any).buildViewerKey(
      1,
      null,
      visitorId,
    );

    const secondKey = (service as any).buildViewerKey(
      2,
      null,
      visitorId,
    );

    expect(firstKey).toMatch(/^v3:[a-f0-9]{64}$/);
    expect(secondKey).toMatch(/^v3:[a-f0-9]{64}$/);
    expect(firstKey).not.toBe(secondKey);
  });

  it('should produce different keys for a logged-in viewer and a guest', () => {
    const guestKey = (service as any).buildViewerKey(
      1,
      null,
      visitorId,
    );

    const accountKey = (service as any).buildViewerKey(
      1,
      42,
      visitorId,
    );

    expect(guestKey).toMatch(/^v3:[a-f0-9]{64}$/);
    expect(accountKey).toMatch(/^v3:[a-f0-9]{64}$/);
    expect(accountKey).not.toBe(guestKey);
  });

  it('should use the same key for the same logged-in account regardless of visitorId', () => {
    const firstKey = (service as any).buildViewerKey(
      1,
      42,
      '550e8400-e29b-41d4-a716-446655440000',
    );

    const secondKey = (service as any).buildViewerKey(
      1,
      42,
      '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    );

    expect(firstKey).toBe(secondKey);
  });
});

  describe('recordViewWithDeduplication', () => {
    it('should retry when transaction has write conflict (P2034)', async () => {
      const conflictError = new Prisma.PrismaClientKnownRequestError(
        'Transaction conflict',
        {
          code: 'P2034',
          clientVersion: 'test',
        },
      );

        mockPrismaService.$transaction
          .mockRejectedValueOnce(conflictError)
          .mockResolvedValueOnce(true);

        await expect(
          (service as any).recordViewWithDeduplication(1, 'viewer-1'),
        ).resolves.toBe(true);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    });
  });
});
