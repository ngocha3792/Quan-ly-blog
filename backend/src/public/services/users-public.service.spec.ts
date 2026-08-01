import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { UserNotFoundException } from '@app/core';
import { UsersPublicService } from './users-public.service';
import { PostsPublicService } from './posts-public.service';
import { UserRole, UserStatus } from '@prisma/client';

describe('UsersPublicService', () => {
  let service: UsersPublicService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    userFollow: {
      groupBy: jest.Mock;
    };
  };
  let postsPublicService: {
    findAll: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      userFollow: {
        groupBy: jest.fn(),
      },
    };

    postsPublicService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersPublicService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: PostsPublicService,
          useValue: postsPublicService,
        },
      ],
    }).compile();

    service = module.get<UsersPublicService>(UsersPublicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTopAuthors', () => {
    it('should return fallback active authors if no follows found', async () => {
      prisma.userFollow.groupBy.mockResolvedValueOnce([]);
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 10, username: 'defaultAuthor', avatarUrl: 'url10', bio: 'bio10' },
      ]);

      const result = await service.getTopAuthors(5);

      expect(prisma.userFollow.groupBy).toHaveBeenCalledWith({
        by: ['followingId'],
        _count: { followingId: true },
        orderBy: { _count: { followingId: 'desc' } },
        take: 5,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          status: UserStatus.ACTIVE,
          role: UserRole.BLOG_OWNER,
          deletedAt: null,
        },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          bio: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      });
      expect(result).toEqual([
        {
          id: 10,
          username: 'defaultAuthor',
          avatarUrl: 'url10',
          bio: 'bio10',
          followerCount: 0,
        },
      ]);
    });

    it('should return top authors mapped with user details', async () => {
      prisma.userFollow.groupBy.mockResolvedValueOnce([
        { followingId: 1, _count: { followingId: 50 } },
        { followingId: 2, _count: { followingId: 30 } },
      ]);

      prisma.user.findMany.mockResolvedValueOnce([
        { id: 1, username: 'author1', avatarUrl: 'url1', bio: 'bio1' },
        { id: 2, username: 'author2', avatarUrl: 'url2', bio: 'bio2' },
      ]);

      const result = await service.getTopAuthors(10);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2] },
          status: UserStatus.ACTIVE,
          role: UserRole.BLOG_OWNER,
          deletedAt: null,
        },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          bio: true,
        },
      });

      expect(result).toEqual([
        {
          id: 1,
          username: 'author1',
          avatarUrl: 'url1',
          bio: 'bio1',
          followerCount: 50,
        },
        {
          id: 2,
          username: 'author2',
          avatarUrl: 'url2',
          bio: 'bio2',
          followerCount: 30,
        },
      ]);
    });
  });
});
