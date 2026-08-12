import { Test, TestingModule } from '@nestjs/testing';
import { PostsPublicService } from './posts-public.service';
import { PrismaService, PostsService, LanguagesService } from '@app/core';
import { PostStatus, Prisma } from '@prisma/client';

describe('PostsPublicService', () => {
  let service: PostsPublicService;

  const mockPrismaService = {
    post: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    postViewLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockPostsService = {
    findOne: jest.fn(),
    incrementViewCount: jest.fn(),
  };

  const mockLanguagesService = {
    getIdByCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockPrismaService.$transaction.mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(mockPrismaService);
      }
      return cb;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsPublicService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PostsService, useValue: mockPostsService },
        { provide: LanguagesService, useValue: mockLanguagesService },
      ],
    }).compile();

    service = module.get<PostsPublicService>(PostsPublicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    const mockPost = {
      id: 1,
      title: 'Test Post',
      status: PostStatus.PUBLISH,
      languageId: 1,
    };

    it('should return post and record view if not viewed within 5 minutes', async () => {
      mockPostsService.findOne.mockResolvedValueOnce(mockPost);
      mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.postViewLog.create.mockResolvedValueOnce({ id: 100 });
      mockPrismaService.post.update.mockResolvedValueOnce({ id: 1, viewCount: 1 });

      const result = await service.findOne(1, null, '127.0.0.1');

      expect(result.id).toBe(1);

      // Wait a microtask tick for fire-and-forget Promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrismaService.postViewLog.findFirst).toHaveBeenCalledWith({
        where: {
          postId: 1,
          viewerKey: '127.0.0.1',
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
          viewerKey: '127.0.0.1',
        },
      });
      expect(mockPrismaService.post.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { viewCount: { increment: 1 } },
      });
    });

    it('should deduplicate view if viewed within 5 minutes', async () => {
      mockPostsService.findOne.mockResolvedValueOnce(mockPost);
      mockPrismaService.postViewLog.findFirst.mockResolvedValueOnce({
        id: 99,
      });

      const result = await service.findOne(1, null, '127.0.0.1');

      expect(result.id).toBe(1);

      // Wait a microtask tick for fire-and-forget Promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockPrismaService.postViewLog.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.postViewLog.create).not.toHaveBeenCalled();
      expect(mockPrismaService.post.update).not.toHaveBeenCalled();
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
