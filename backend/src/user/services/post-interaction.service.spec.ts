import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostNotFoundException } from '@app/core/common/exceptions';
import { PostInteractionService } from './post-interaction.service';

describe('PostInteractionService', () => {
  let service: PostInteractionService;
  let prisma: {
    post: { findFirst: jest.Mock };
    postLike: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    postBookmark: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      post: {
        findFirst: jest.fn(),
      },
      postLike: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      postBookmark: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostInteractionService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PostInteractionService>(PostInteractionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('likePost', () => {
    it('should throw PostNotFoundException if post not found or not published', async () => {
      prisma.post.findFirst.mockResolvedValueOnce(null);

      await expect(service.likePost(1, 100)).rejects.toThrow(
        PostNotFoundException,
      );
      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: { id: 100, deletedAt: null, status: 'PUBLISH' },
      });
    });

    it('should upsert like and return entity idempotently', async () => {
      prisma.post.findFirst.mockResolvedValueOnce({ id: 100 });
      prisma.postLike.upsert.mockResolvedValueOnce({
        postId: 100,
        userId: 1,
        createdAt: new Date(),
      });

      const result = await service.likePost(1, 100);
      expect(prisma.postLike.upsert).toHaveBeenCalledWith({
        where: { postId_userId: { postId: 100, userId: 1 } },
        update: {},
        create: { postId: 100, userId: 1 },
      });
      expect(result.postId).toBe(100);
    });
  });

  describe('unlikePost', () => {
    it('should deleteMany like idempotently and return success message', async () => {
      prisma.post.findFirst.mockResolvedValueOnce({ id: 100 });
      prisma.postLike.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.unlikePost(1, 100);
      expect(prisma.postLike.deleteMany).toHaveBeenCalledWith({
        where: { postId: 100, userId: 1 },
      });
      expect(result.message).toBe('Đã bỏ thích bài viết thành công');
    });
  });

  describe('bookmarkPost and unbookmarkPost', () => {
    it('should bookmark post successfully with upsert', async () => {
      prisma.post.findFirst.mockResolvedValueOnce({ id: 100 });
      prisma.postBookmark.upsert.mockResolvedValueOnce({
        postId: 100,
        userId: 1,
        createdAt: new Date(),
      });

      const result = await service.bookmarkPost(1, 100);
      expect(prisma.postBookmark.upsert).toHaveBeenCalledWith({
        where: { postId_userId: { postId: 100, userId: 1 } },
        update: {},
        create: { postId: 100, userId: 1 },
      });
      expect(result.postId).toBe(100);
    });

    it('should unbookmark post successfully with deleteMany', async () => {
      prisma.post.findFirst.mockResolvedValueOnce({ id: 100 });
      prisma.postBookmark.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.unbookmarkPost(1, 100);
      expect(prisma.postBookmark.deleteMany).toHaveBeenCalledWith({
        where: { postId: 100, userId: 1 },
      });
      expect(result.message).toBe('Đã bỏ lưu bài viết thành công');
    });
  });

  describe('getBookmarkedPosts', () => {
    it('should return bookmarked posts mapped to UserPostEntity', async () => {
      prisma.postBookmark.count.mockResolvedValueOnce(1);
      prisma.postBookmark.findMany.mockResolvedValueOnce([
        {
          post: {
            id: 10,
            title: 'Bookmarked post',
            _count: { postLikes: 2 },
          },
        },
      ]);

      const result = await service.getBookmarkedPosts(1, {
        page: 1,
        take: 10,
        skip: 0,
      });

      expect(result.meta.totalItems).toBe(1);
      expect(result.items[0].id).toBe(10);
      expect(result.items[0].likeCount).toBe(2);
    });
  });

  describe('getLikedPosts', () => {
    it('should return liked posts mapped to UserPostEntity', async () => {
      prisma.postLike.count.mockResolvedValueOnce(1);
      prisma.postLike.findMany.mockResolvedValueOnce([
        {
          post: {
            id: 20,
            title: 'Liked post',
            _count: { postLikes: 5 },
          },
        },
      ]);

      const result = await service.getLikedPosts(1, {
        page: 1,
        take: 10,
        skip: 0,
      });

      expect(result.meta.totalItems).toBe(1);
      expect(result.items[0].id).toBe(20);
      expect(result.items[0].likeCount).toBe(5);
    });
  });
});
