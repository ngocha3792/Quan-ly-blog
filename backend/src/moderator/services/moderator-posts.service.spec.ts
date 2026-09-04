import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus } from '@prisma/client';

import {
  PostNotFoundException,
  PostsService,
  PrismaService,
  SearchIndexService,
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

  const mockSearchIndexService = {
    syncSearchIndex: jest.fn(),
    syncSearchIndexGroup: jest.fn(),
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
          PostsService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: SearchIndexService,
            useValue: mockSearchIndexService,
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
            AND: [
              {
                parentPostId: null,
              },
             ],
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

    it('should return a moderator post with language versions', async () => {
  mockPrismaService.post.findFirst.mockResolvedValueOnce(
    basePost,
  );

  mockPrismaService.post.findMany.mockResolvedValueOnce([
    {
      id: 1,
      title: 'Bài viết chờ duyệt',
      thumbnailUrl: null,
      status: PostStatus.PENDING_REVIEW,
      parentPostId: null,
      languageId: 4,

      language: {
        id: 4,
        code: 'vi',
        name: 'Tiếng Việt',
        flag: '🇻🇳',
      },
    },

    {
      id: 2,
      title: 'Pending English article',
      thumbnailUrl: null,
      status: PostStatus.PENDING_REVIEW,
      parentPostId: 1,
      languageId: 5,

      language: {
        id: 5,
        code: 'en',
        name: 'English',
        flag: '🇺🇸',
      },
    },
  ]);

  const result = await service.findOne(1);

  expect(result.id).toBe(1);

  expect(result.status).toBe(
    PostStatus.PENDING_REVIEW,
  );

  expect(result.translations).toHaveLength(2);

  expect(result.translations?.map(
    (version) => version.language.code,
  )).toEqual([
    'vi',
    'en',
  ]);
});
  });

  describe('approve', () => {
    it('should approve a pending root post and its translations', async () => {
  /**
   * Lần 1:
   * selectedPost.
   *
   * Phải khai báo parentPostId: null,
   * nếu không service sẽ hiểu đây là translation.
   */
  mockPrismaService.post.findFirst
    .mockResolvedValueOnce({
      id: 1,
      parentPostId: null,
      status: PostStatus.PENDING_REVIEW,
    })

    /**
     * Lần cuối:
     * lấy ROOT sau khi approve.
     */
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

  /**
   * Toàn post group:
   *
   * ROOT id 1
   * EN translation id 2
   */
  mockPrismaService.post.findMany.mockResolvedValueOnce([
    {
      id: 1,
      parentPostId: null,
      status: PostStatus.PENDING_REVIEW,
      publishedAt: null,
    },

    {
      id: 2,
      parentPostId: 1,
      status: PostStatus.PENDING_REVIEW,
      publishedAt: null,
    },
  ]);

  /**
   * updateMany lần 1 = claim ROOT.
   * updateMany lần 2 = approve translation.
   */
  mockPrismaService.post.updateMany
    .mockResolvedValueOnce({
      count: 1,
    })
    .mockResolvedValueOnce({
      count: 1,
    });

  const result = await service.approve(2, 1);

  /**
   * ROOT được approve.
   */
  expect(
    mockPrismaService.post.updateMany,
  ).toHaveBeenNthCalledWith(1, {
    where: {
      id: 1,
      parentPostId: null,
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

  /**
   * Translation cũng được approve.
   */
  expect(
    mockPrismaService.post.updateMany,
  ).toHaveBeenNthCalledWith(2, {
    where: {
      id: 2,
      parentPostId: 1,
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

  expect(result.status).toBe(
    PostStatus.PUBLISH,
  );
});

    it('should reject approving a non-pending post', async () => {
  mockPrismaService.post.findFirst.mockResolvedValueOnce({
    id: 1,
    parentPostId: null,
    status: PostStatus.PUBLISH,
  });

  mockPrismaService.post.findMany.mockResolvedValueOnce([
    {
      id: 1,
      parentPostId: null,
      status: PostStatus.PUBLISH,
      publishedAt: date,
    },
  ]);

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
    parentPostId: null,
    status: PostStatus.PENDING_REVIEW,
  });

  mockPrismaService.post.findMany.mockResolvedValueOnce([
    {
      id: 1,
      parentPostId: null,
      status: PostStatus.PENDING_REVIEW,
      publishedAt: null,
    },
  ]);

  /**
   * Có Moderator khác claim ROOT trước.
   *
   * updateMany không update được row nào.
   */
  mockPrismaService.post.updateMany.mockResolvedValueOnce({
    count: 0,
  });

  await expect(
    service.approve(2, 1),
  ).rejects.toThrow(ConflictException);
});
    it('should reject approving a translation directly', async () => {
  mockPrismaService.post.findFirst.mockResolvedValueOnce({
    id: 2,
    parentPostId: 1,
    status: PostStatus.PENDING_REVIEW,
  });

  await expect(
    service.approve(2, 2),
  ).rejects.toThrow(BadRequestException);

  expect(
    mockPrismaService.post.updateMany,
  ).not.toHaveBeenCalled();
});
  });

  describe('reject', () => {
    it('should reject a pending root post and its translations with the same reason', async () => {
  const rejectionReason =
    'Bài viết cần bổ sung nguồn tham khảo.';

  mockPrismaService.post.findFirst
    .mockResolvedValueOnce({
      id: 1,
      parentPostId: null,
      status: PostStatus.PENDING_REVIEW,
    })

    .mockResolvedValueOnce({
      ...basePost,
      status: PostStatus.REJECT,
      reviewedById: 2,
      reviewedAt: date,
      rejectionReason,

      reviewedBy: {
        id: 2,
        username: 'moderator',
        avatarUrl: null,
      },
    });

  /**
   * ROOT + một translation.
   */
  mockPrismaService.post.findMany.mockResolvedValueOnce([
    {
      id: 1,
      parentPostId: null,
      status: PostStatus.PENDING_REVIEW,
    },

    {
      id: 2,
      parentPostId: 1,
      status: PostStatus.PENDING_REVIEW,
    },
  ]);

  mockPrismaService.post.updateMany
    .mockResolvedValueOnce({
      count: 1,
    })
    .mockResolvedValueOnce({
      count: 1,
    });

  const result = await service.reject(2, 1, {
    rejectionReason,
  });

  /**
   * ROOT.
   */
  expect(
    mockPrismaService.post.updateMany,
  ).toHaveBeenNthCalledWith(1, {
    where: {
      id: 1,
      parentPostId: null,
      status: PostStatus.PENDING_REVIEW,
      deletedAt: null,
    },

    data: {
      status: PostStatus.REJECT,
      reviewedById: 2,
      reviewedAt: expect.any(Date),
      rejectionReason,
    },
  });

  /**
   * Translation.
   */
  expect(
    mockPrismaService.post.updateMany,
  ).toHaveBeenNthCalledWith(2, {
    where: {
      id: 2,
      parentPostId: 1,
      status: PostStatus.PENDING_REVIEW,
      deletedAt: null,
    },

    data: {
      status: PostStatus.REJECT,
      reviewedById: 2,
      reviewedAt: expect.any(Date),
      rejectionReason,
    },
  });

  expect(result.status).toBe(
    PostStatus.REJECT,
  );

  expect(result.rejectionReason).toBe(
    rejectionReason,
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

    it('should reject processing a translation directly', async () => {
  mockPrismaService.post.findFirst.mockResolvedValueOnce({
    id: 2,
    parentPostId: 1,
    status: PostStatus.PENDING_REVIEW,
  });

  await expect(
    service.reject(2, 2, {
      rejectionReason: 'Không hợp lệ.',
    }),
  ).rejects.toThrow(BadRequestException);

  expect(
    mockPrismaService.post.updateMany,
  ).not.toHaveBeenCalled();
});
  });
});