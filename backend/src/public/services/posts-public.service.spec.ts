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
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    postViewLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
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
    const mockPost = {
      id: 1,
      title: 'Test Post',
      status: PostStatus.PUBLISH,
      languageId: 1,
    };

    it('should require the post language to be active and non-deleted', async () => {
      mockPostsService.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Test Post',
        status: PostStatus.PUBLISH,
        languageId: 1,
      });

      mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce({
        id: 99,
      });

      await service.findOne(1, null, '127.0.0.1', 'Mozilla/5.0', null);

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

    it('should hash viewer identity before storing view log', async () => {
      mockPostsService.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Test Post',
        status: PostStatus.PUBLISH,
        languageId: 1,
      });

      mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce(null);

      mockPrismaService.postViewLog.create.mockResolvedValueOnce({
        id: 100,
      });

      mockPrismaService.post.update.mockResolvedValueOnce({
        id: 1,
        viewCount: 1,
      });

      const result = await service.findOne(
        1,
        null,
        // IPv4 mapped IPv6
        '::ffff:127.0.0.1',
        'Mozilla/5.0 Test Browser',
        null,
      );

      expect(result.id).toBe(1);

      const expectedViewerKey = `v2:${createHmac(
        'sha256',
        'test-viewer-key-secret',
      )
        .update(
          ['post:1', 'ip:127.0.0.1', 'ua:Mozilla/5.0 Test Browser'].join('\n'),
        )
        .digest('hex')}`;

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrismaService.postViewLog.findFirst).toHaveBeenCalledWith({
        where: {
          postId: 1,
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
          postId: 1,
          viewerKey: expectedViewerKey,
        },
      });

      expect(expectedViewerKey).not.toContain('127.0.0.1');
    });

    it('should key the view by account id instead of IP/User-Agent when a valid Bearer token is sent', async () => {
      mockPostsService.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Test Post',
        status: PostStatus.PUBLISH,
        languageId: 1,
      });

      mockJwtUtil.verifyAccessToken.mockReturnValueOnce({ sub: '42' });

      mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.postViewLog.create.mockResolvedValueOnce({ id: 100 });
      mockPrismaService.post.update.mockResolvedValueOnce({
        id: 1,
        viewCount: 1,
      });

      await service.findOne(
        1,
        null,
        '127.0.0.1',
        'Mozilla/5.0',
        'Bearer some-valid-token',
      );

      const expectedViewerKey = `v2:${createHmac(
        'sha256',
        'test-viewer-key-secret',
      )
        .update(['post:1', 'user:42'].join('\n'))
        .digest('hex')}`;

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockJwtUtil.verifyAccessToken).toHaveBeenCalledWith(
        'some-valid-token',
      );

      expect(mockPrismaService.postViewLog.create).toHaveBeenCalledWith({
        data: {
          postId: 1,
          viewerKey: expectedViewerKey,
        },
      });
    });

    it('should fall back to the anonymous fingerprint when the Bearer token is invalid', async () => {
      mockPostsService.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Test Post',
        status: PostStatus.PUBLISH,
        languageId: 1,
      });

      mockJwtUtil.verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid token');
      });

      mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce({
        id: 99,
      });

      const result = await service.findOne(
        1,
        null,
        '127.0.0.1',
        'Mozilla/5.0',
        'Bearer bad-token',
      );

      expect(result.id).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 20));

      const expectedViewerKey = `v2:${createHmac(
        'sha256',
        'test-viewer-key-secret',
      )
        .update(['post:1', 'ip:127.0.0.1', 'ua:Mozilla/5.0'].join('\n'))
        .digest('hex')}`;

      expect(mockPrismaService.postViewLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ viewerKey: expectedViewerKey }),
        }),
      );
    });

    it('should deduplicate view if viewed within 5 minutes', async () => {
      mockPostsService.findOne.mockResolvedValueOnce(mockPost);
      mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce({
        id: 99,
      });

      const result = await service.findOne(
        1,
        null,
        '127.0.0.1',
        'Mozilla/5.0',
        null,
      );

      expect(result.id).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrismaService.postViewLog.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.postViewLog.create).not.toHaveBeenCalled();
      expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    });

    it('should skip view tracking when both IP and User-Agent are missing', async () => {
      mockPostsService.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Test Post',
        status: PostStatus.PUBLISH,
        languageId: 1,
      });

      const result = await service.findOne(1, null, null, null, null);

      expect(result.id).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.postViewLog.create).not.toHaveBeenCalled();
      expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    });

    it('should not store raw viewer data when VIEWER_KEY_SECRET is missing', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.viewerKeySecret') return undefined;
        return undefined;
      });

      mockPostsService.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Test Post',
        status: PostStatus.PUBLISH,
        languageId: 1,
      });

      const result = await service.findOne(
        1,
        null,
        '127.0.0.1',
        'Mozilla/5.0',
        null,
      );

      expect(result.id).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.postViewLog.create).not.toHaveBeenCalled();
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
    it('should produce different keys for the same viewer on different posts', () => {
      const firstKey = (service as any).buildViewerKey(
        1,
        null,
        '127.0.0.1',
        'Mozilla/5.0',
      );

      const secondKey = (service as any).buildViewerKey(
        2,
        null,
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(firstKey).toMatch(/^v2:[a-f0-9]{64}$/);
      expect(secondKey).toMatch(/^v2:[a-f0-9]{64}$/);
      expect(firstKey).not.toBe(secondKey);
    });

    it('should produce different keys for a logged-in viewer than for a guest with the same IP/User-Agent', () => {
      const guestKey = (service as any).buildViewerKey(
        1,
        null,
        '127.0.0.1',
        'Mozilla/5.0',
      );

      const accountKey = (service as any).buildViewerKey(
        1,
        42,
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(accountKey).toMatch(/^v2:[a-f0-9]{64}$/);
      expect(accountKey).not.toBe(guestKey);
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
        .mockResolvedValueOnce(undefined);

      await expect(
        (service as any).recordViewWithDeduplication(1, 'viewer-1'),
      ).resolves.toBeUndefined();

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    });
  });
});
