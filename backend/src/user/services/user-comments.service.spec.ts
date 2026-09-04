import { BadRequestException } from '@nestjs/common';

import { Test, TestingModule } from '@nestjs/testing';

import { CommentRateLimitExceededException, CommentsService } from '@app/core';

import { PrismaService } from '@app/core/core/prisma/prisma.service';

import { UserCommentsService } from './user-comments.service';

describe('UserCommentsService', () => {
  let service: UserCommentsService;

  const tx = {
    $executeRaw: jest.fn(),

    comment: {
      findMany: jest.fn(),
    },
  };

  const mockPrismaService = {
    $transaction: jest.fn(),
  };

  const mockCommentsService = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockPrismaService.$transaction.mockImplementation(
      async (callback: (prismaTx: typeof tx) => unknown) => callback(tx),
    );

    tx.$executeRaw.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserCommentsService,

        {
          provide: PrismaService,

          useValue: mockPrismaService,
        },

        {
          provide: CommentsService,

          useValue: mockCommentsService,
        },
      ],
    }).compile();

    service = module.get(UserCommentsService);
  });

  describe('create', () => {
    it('should acquire a transaction advisory lock before checking recent comments', async () => {
      tx.comment.findMany.mockResolvedValueOnce([]);

      mockCommentsService.create.mockResolvedValueOnce({
        id: 10,
        userId: 1,
        postId: 5,
        content: 'Hello',
      });

      await service.create(1, 5, {
        content: 'Hello',
      });

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);

      expect(tx.comment.findMany).toHaveBeenCalledWith({
        where: {
          userId: 1,

          createdAt: {
            gte: expect.any(Date),
          },
        },

        select: {
          postId: true,
          content: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 5,
      });
    });

    it('should create comment inside the same transaction', async () => {
      tx.comment.findMany.mockResolvedValueOnce([]);

      mockCommentsService.create.mockResolvedValueOnce({
        id: 10,
      });

      await service.create(1, 5, {
        content: 'Hello',
      });

      expect(mockCommentsService.create).toHaveBeenCalledWith(
        1,

        {
          postId: 5,
          content: 'Hello',
        },

        tx,
      );
    });

    it('should reject the sixth comment within one minute', async () => {
      tx.comment.findMany.mockResolvedValueOnce([
        {
          postId: 1,
          content: '1',
          createdAt: new Date(),
        },
        {
          postId: 1,
          content: '2',
          createdAt: new Date(),
        },
        {
          postId: 1,
          content: '3',
          createdAt: new Date(),
        },
        {
          postId: 1,
          content: '4',
          createdAt: new Date(),
        },
        {
          postId: 1,
          content: '5',
          createdAt: new Date(),
        },
      ]);

      await expect(
        service.create(1, 5, {
          content: 'Sixth',
        }),
      ).rejects.toThrow(CommentRateLimitExceededException);

      expect(mockCommentsService.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate content in the same post within one minute', async () => {
      tx.comment.findMany.mockResolvedValueOnce([
        {
          postId: 5,

          content: 'Hello world',

          createdAt: new Date(),
        },
      ]);

      await expect(
        service.create(1, 5, {
          content: '  Hello world  ',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockCommentsService.create).not.toHaveBeenCalled();
    });

    it('should allow the same content on another post', async () => {
      tx.comment.findMany.mockResolvedValueOnce([
        {
          postId: 99,

          content: 'Hello world',

          createdAt: new Date(),
        },
      ]);

      mockCommentsService.create.mockResolvedValueOnce({
        id: 20,
      });

      await expect(
        service.create(1, 5, {
          content: 'Hello world',
        }),
      ).resolves.toEqual({
        id: 20,
      });

      expect(mockCommentsService.create).toHaveBeenCalled();
    });
  });
});
