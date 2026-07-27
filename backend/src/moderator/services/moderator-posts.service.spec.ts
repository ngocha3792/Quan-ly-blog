import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus } from '@prisma/client';

import {
  PostNotFoundException,
  PrismaService,
} from '@app/core';

import { ModeratorPostsService } from './moderator-posts.service';

describe('ModeratorPostsService', () => {
  let service: ModeratorPostsService;

  const date = new Date(
    '2026-07-28T00:00:00.000Z',
  );

  const basePost = {
    id: 1,
    title: 'Bài viết chờ duyệt',
    thumbnailUrl: null,
    content: 'Nội dung bài viết',
    status: PostStatus.PENDING_REVIEW,
    viewCount: 0,
    publishedAt: null,

    parentPostId: null,
    authorId: 3,
    languageId: 4,

    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,

    createdAt: date,
    updatedAt: date,
    deletedAt: null,

    author: {
      id: 3,
      username: 'pro_blogger',
      bio: null,
      avatarUrl: null,
    },

    language: {
      id: 4,
      code: 'vi',
      name: 'Tiếng Việt',
      flag: 'VN',
      createdAt: date,
      updatedAt: date,
      deletedAt: null,
    },

    reviewedBy: null,
    postCategories: [],
    postTags: [],
    media: [],
  };

  const mockPrismaService = {
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },

    tag: {
      findFirst: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    /*
     * Cho callback transaction chạy trực tiếp
     * với mock Prisma hiện tại.
     */
    mockPrismaService.$transaction.mockImplementation(
      async (callback) =>
        callback(mockPrismaService),
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          ModeratorPostsService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

    service = module.get<ModeratorPostsService>(
      ModeratorPostsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return pending posts by default', async () => {
      mockPrismaService.post.findMany.mockResolvedValueOnce([
        basePost,
      ]);

      mockPrismaService.post.count.mockResolvedValueOnce(1);

      const result = await service.findAll(
        {},
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      );

      expect(
        mockPrismaService.post.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            status: PostStatus.PENDING_REVIEW,
          },
          skip: 0,
          take: 10,
          orderBy: {
            updatedAt: 'asc',
          },
          include: expect.any(Object),
        }),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(1);

      expect(result.meta).toEqual({
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      });
    });

    it('should reject DRAFT status', async () => {
      await expect(
        service.findAll(
          {
            status: PostStatus.DRAFT,
          },
          {
            skip: 0,
            take: 10,
            page: 1,
          },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(
        mockPrismaService.post.findMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw PostNotFoundException when post is not visible to moderator', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce(
        null,
      );

      await expect(service.findOne(999)).rejects.toThrow(
        PostNotFoundException,
      );
    });

    it('should return a moderator post', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce(
        basePost,
      );

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.status).toBe(
        PostStatus.PENDING_REVIEW,
      );
    });
  });

  describe('approve', () => {
    it('should approve a pending post', async () => {
      mockPrismaService.post.findFirst
        .mockResolvedValueOnce({
          id: 1,
          status: PostStatus.PENDING_REVIEW,
          publishedAt: null,
        })
        .mockResolvedValueOnce({
          ...basePost,
          status: PostStatus.PUBLISH,
          reviewedById: 2,
          reviewedAt: date,
          publishedAt: date,
          reviewedBy: {
            id: 2,
            username: 'moderator',
            avatarUrl: null,
          },
        });

      mockPrismaService.post.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.approve(2, 1);

      expect(
        mockPrismaService.post.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 1,
          status: PostStatus.PENDING_REVIEW,
          deletedAt: null,
        },
        data: {
          status: PostStatus.PUBLISH,
          reviewedById: 2,
          reviewedAt: expect.any(Date),
          rejectionReason: null,
          publishedAt: expect.any(Date),
        },
      });

      expect(result.status).toBe(PostStatus.PUBLISH);
    });

    it('should reject approving a non-pending post', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
        status: PostStatus.PUBLISH,
        publishedAt: date,
      });

      await expect(
        service.approve(2, 1),
      ).rejects.toThrow(BadRequestException);

      expect(
        mockPrismaService.post.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('should detect concurrent moderation', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
        status: PostStatus.PENDING_REVIEW,
        publishedAt: null,
      });

      mockPrismaService.post.updateMany.mockResolvedValueOnce({
        count: 0,
      });

      await expect(
        service.approve(2, 1),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reject', () => {
    it('should reject a pending post with a reason', async () => {
      mockPrismaService.post.findFirst
        .mockResolvedValueOnce({
          id: 1,
          status: PostStatus.PENDING_REVIEW,
        })
        .mockResolvedValueOnce({
          ...basePost,
          status: PostStatus.REJECT,
          reviewedById: 2,
          reviewedAt: date,
          rejectionReason:
            'Bài viết cần bổ sung nguồn tham khảo.',
          reviewedBy: {
            id: 2,
            username: 'moderator',
            avatarUrl: null,
          },
        });

      mockPrismaService.post.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.reject(2, 1, {
        rejectionReason:
          'Bài viết cần bổ sung nguồn tham khảo.',
      });

      expect(
        mockPrismaService.post.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 1,
          status: PostStatus.PENDING_REVIEW,
          deletedAt: null,
        },
        data: {
          status: PostStatus.REJECT,
          reviewedById: 2,
          reviewedAt: expect.any(Date),
          rejectionReason:
            'Bài viết cần bổ sung nguồn tham khảo.',
        },
      });

      expect(result.status).toBe(PostStatus.REJECT);
      expect(result.rejectionReason).toBe(
        'Bài viết cần bổ sung nguồn tham khảo.',
      );
    });

    it('should reject processing a missing post', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce(
        null,
      );

      await expect(
        service.reject(2, 999, {
          rejectionReason: 'Không hợp lệ.',
        }),
      ).rejects.toThrow(PostNotFoundException);

      expect(
        mockPrismaService.post.updateMany,
      ).not.toHaveBeenCalled();
    });
  });
});