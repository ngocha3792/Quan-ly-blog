import { Test, TestingModule } from '@nestjs/testing';

import {
  CommentNotFoundException,
  PostNotFoundException,
  PrismaService,
} from '@app/core';

import { CommentsPublicService } from './comments-public.service';

describe('CommentsPublicService', () => {
  let service: CommentsPublicService;
  let prisma: PrismaService;

  const mockPrismaService = {
    post: {
      findFirst: jest.fn(),
    },

    comment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsPublicService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CommentsPublicService>(CommentsPublicService);

    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject comments of a post that is not public', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.findAllByPost(
        999,
        {},
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      ),
    ).rejects.toThrow(PostNotFoundException);

    expect(prisma.comment.findMany).not.toHaveBeenCalled();
    expect(prisma.comment.count).not.toHaveBeenCalled();
  });

  it('should return root comments with limited reply previews and reply count', async () => {
    const createdAt = new Date('2026-07-27T10:00:00.000Z');
    const updatedAt = new Date('2026-07-27T10:00:00.000Z');

    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 1,
    });

    mockPrismaService.comment.findMany.mockResolvedValueOnce([
      {
        id: 1,
        postId: 1,
        userId: 4,
        parentId: null,
        content: 'Bình luận gốc',
        createdAt,
        updatedAt,
        deletedAt: null,

        user: {
          id: 4,
          username: 'user01',
          avatarUrl: null,
        },

        replies: [
          {
            id: 2,
            postId: 1,
            userId: 3,
            parentId: 1,
            content: 'Reply 1',
            createdAt,
            updatedAt,
            deletedAt: null,

            user: {
              id: 3,
              username: 'blogger01',
              avatarUrl: null,
            },
          },

          {
            id: 3,
            postId: 1,
            userId: 5,
            parentId: 1,
            content: 'Reply 2',
            createdAt,
            updatedAt,
            deletedAt: null,

            user: {
              id: 5,
              username: 'user02',
              avatarUrl: null,
            },
          },

          {
            id: 4,
            postId: 1,
            userId: 6,
            parentId: 1,
            content: 'Reply 3',
            createdAt,
            updatedAt,
            deletedAt: null,

            user: {
              id: 6,
              username: 'user03',
              avatarUrl: null,
            },
          },
        ],

        _count: {
          replies: 100,
        },
      },
    ]);

    mockPrismaService.comment.count.mockResolvedValueOnce(1);

    const result = await service.findAllByPost(
      1,
      {},
      {
        skip: 0,
        take: 10,
        page: 1,
      },
    );

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          postId: 1,
          parentId: null,
          deletedAt: null,
        },

        skip: 0,
        take: 10,

        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],

        select: expect.objectContaining({
          id: true,

          replies: expect.objectContaining({
            take: 3,

            orderBy: {
              id: 'asc',
            },
          }),

          _count: expect.any(Object),
        }),
      }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].replies).toHaveLength(3);
    expect(result.items[0].replyCount).toBe(100);
    expect(result.items[0].hasMoreReplies).toBe(true);
  });

  it('should return an empty list when the post has no comments', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 1,
    });

    mockPrismaService.comment.findMany.mockResolvedValueOnce([]);
    mockPrismaService.comment.count.mockResolvedValueOnce(0);

    const result = await service.findAllByPost(
      1,
      {},
      {
        skip: 0,
        take: 10,
        page: 1,
      },
    );

    expect(result.items).toEqual([]);

    expect(result.meta).toEqual({
      totalItems: 0,
      itemCount: 0,
      itemsPerPage: 10,
      totalPages: 0,
      currentPage: 1,
    });
  });

  describe('findRepliesByComment', () => {
    it('should return replies using cursor pagination', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
      });

      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 10,
      });

      mockPrismaService.comment.findMany.mockResolvedValueOnce([
        {
          id: 21,
          postId: 1,
          userId: 2,
          parentId: 10,
          content: 'Reply 21',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,

          user: {
            id: 2,
            username: 'u2',
            avatarUrl: null,
          },
        },

        {
          id: 22,
          postId: 1,
          userId: 3,
          parentId: 10,
          content: 'Reply 22',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,

          user: {
            id: 3,
            username: 'u3',
            avatarUrl: null,
          },
        },

        {
          id: 23,
          postId: 1,
          userId: 4,
          parentId: 10,
          content: 'Reply 23',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,

          user: {
            id: 4,
            username: 'u4',
            avatarUrl: null,
          },
        },
      ]);

      const result = await service.findRepliesByComment(1, 10, {
        cursor: 20,
        limit: 2,
      });

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          postId: 1,
          parentId: 10,
          deletedAt: null,

          id: {
            gt: 20,
          },
        },

        orderBy: {
          id: 'asc',
        },

        take: 3,

        select: expect.any(Object),
      });

      expect(result.items.map((reply) => reply.id)).toEqual([21, 22]);

      expect(result.meta).toEqual({
        itemCount: 2,
        hasMore: true,
        nextCursor: 22,
      });
    });

    it('should reject a root comment that does not belong to the post', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
      });

      mockPrismaService.comment.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.findRepliesByComment(1, 999, {
          limit: 20,
        }),
      ).rejects.toThrow(CommentNotFoundException);

      expect(prisma.comment.findMany).not.toHaveBeenCalled();
    });
  });
});
