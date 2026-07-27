import { Test, TestingModule } from '@nestjs/testing';

import {
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

    service = module.get<CommentsPublicService>(
      CommentsPublicService,
    );

    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject comments of a post that is not public', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.findAllByPost(999, {
        skip: 0,
        take: 10,
        page: 1,
      }),
    ).rejects.toThrow(PostNotFoundException);

    expect(prisma.comment.findMany).not.toHaveBeenCalled();
    expect(prisma.comment.count).not.toHaveBeenCalled();
  });

  it('should return root comments with nested replies', async () => {
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
            content: 'Phản hồi',
            createdAt,
            updatedAt,
            deletedAt: null,

            user: {
              id: 3,
              username: 'blogger01',
              avatarUrl: null,
            },
          },
        ],
      },
    ]);

    mockPrismaService.comment.count.mockResolvedValueOnce(1);

    const result = await service.findAllByPost(1, {
      skip: 0,
      take: 10,
      page: 1,
    });

    expect(prisma.post.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        status: 'PUBLISH',
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          postId: 1,
          parentId: null,
          deletedAt: null,
        },
        skip: 0,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
        select: expect.objectContaining({
          id: true,
          user: expect.any(Object),
          replies: expect.any(Object),
        }),
      }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(1);
    expect(result.items[0].user?.username).toBe('user01');
    expect(result.items[0].replies).toHaveLength(1);
    expect(result.items[0].replies?.[0].id).toBe(2);

    expect(result.meta).toEqual({
      totalItems: 1,
      itemCount: 1,
      itemsPerPage: 10,
      totalPages: 1,
      currentPage: 1,
    });
  });

  it('should return an empty list when the post has no comments', async () => {
    mockPrismaService.post.findFirst.mockResolvedValueOnce({
      id: 1,
    });

    mockPrismaService.comment.findMany.mockResolvedValueOnce([]);
    mockPrismaService.comment.count.mockResolvedValueOnce(0);

    const result = await service.findAllByPost(1, {
      skip: 0,
      take: 10,
      page: 1,
    });

    expect(result.items).toEqual([]);

    expect(result.meta).toEqual({
      totalItems: 0,
      itemCount: 0,
      itemsPerPage: 10,
      totalPages: 0,
      currentPage: 1,
    });
  });
});