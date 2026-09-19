import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostNotFoundException } from '@app/core/common/exceptions';
import { PostInteractionService } from './post-interaction.service';

describe('PostInteractionService', () => {
  let service: PostInteractionService;
  let prisma: {
    post: {
      findFirst: jest.Mock;
    };
    postLike: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      createMany: jest.Mock;
      delete: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    postDailyMetric: {
      upsert: jest.Mock;
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
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      post: {
        findFirst: jest.fn(),
      },
      postLike: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      postDailyMetric: {
        upsert: jest.fn(),
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
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );

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
        where: {
          id: 100,
          deletedAt: null,
          status: 'PUBLISH',
        },
      });
    });

    it('should create a new like and increment today daily metric by 1', async () => {
      const createdAt = new Date();

      prisma.post.findFirst.mockResolvedValueOnce({
        id: 100,
        parentPostId: null,
      });

      prisma.postLike.createMany.mockResolvedValueOnce({
        count: 1,
      });

      prisma.postDailyMetric.upsert.mockResolvedValueOnce({
        id: 1,
      });

      prisma.postLike.findUniqueOrThrow.mockResolvedValueOnce({
        postId: 100,
        userId: 1,
        createdAt,
      });

      const result = await service.likePost(1, 100);

      expect(prisma.postLike.createMany).toHaveBeenCalledWith({
        data: [
          {
            postId: 100,
            userId: 1,
          },
        ],
        skipDuplicates: true,
      });

      expect(prisma.postDailyMetric.upsert).toHaveBeenCalledWith({
        where: {
          postId_metricDate: {
            postId: 100,
            metricDate: expect.any(Date),
          },
        },
        create: {
          postId: 100,
          metricDate: expect.any(Date),
          viewCount: 0,
          likeCount: 1,
        },
        update: {
          likeCount: {
            increment: 1,
          },
        },
      });

      expect(result.postId).toBe(100);
      expect(result.userId).toBe(1);
    });

    it('should not increment daily metric when the like already exists', async () => {
      prisma.post.findFirst.mockResolvedValueOnce({
        id: 100,
        parentPostId: null,
      });

      /**
       * Duplicate bị skip.
       */
      prisma.postLike.createMany.mockResolvedValueOnce({
        count: 0,
      });

      prisma.postLike.findUniqueOrThrow.mockResolvedValueOnce({
        postId: 100,
        userId: 1,
        createdAt: new Date(),
      });

      const result = await service.likePost(1, 100);

      expect(prisma.postLike.createMany).toHaveBeenCalled();

      expect(prisma.postDailyMetric.upsert).not.toHaveBeenCalled();

      expect(result.postId).toBe(100);
    });

    it('should like the group ROOT when the user is reading a translation, not the translation itself', async () => {
      /**
       * Yêu cầu nghiệp vụ: thích một bài viết là thích cho CẢ BÀI
       * (mọi ngôn ngữ), không phải riêng bản dịch đang đọc. Thích bản
       * tiếng Việt rồi không được thích tiếp bản tiếng Anh cùng bài.
       *
       * postId=200 là bản dịch, parentPostId=100 là bài gốc — like
       * phải được ghi vào postId=100 (root), không phải 200.
       */
      prisma.post.findFirst
        .mockResolvedValueOnce({
          id: 200,
          parentPostId: 100,
        })
        .mockResolvedValueOnce({
          id: 100,
          parentPostId: null,
        });

      prisma.postLike.createMany.mockResolvedValueOnce({
        count: 1,
      });

      prisma.postDailyMetric.upsert.mockResolvedValueOnce({
        id: 1,
      });

      prisma.postLike.findUniqueOrThrow.mockResolvedValueOnce({
        postId: 100,
        userId: 1,
        createdAt: new Date(),
      });

      const result = await service.likePost(1, 200);

      expect(prisma.post.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: 200, deletedAt: null, status: 'PUBLISH' },
      });

      expect(prisma.post.findFirst).toHaveBeenNthCalledWith(2, {
        where: { id: 100, deletedAt: null, status: 'PUBLISH' },
      });

      expect(prisma.postLike.createMany).toHaveBeenCalledWith({
        data: [
          {
            postId: 100,
            userId: 1,
          },
        ],
        skipDuplicates: true,
      });

      expect(result.postId).toBe(100);
    });
  });

  describe('unlikePost', () => {
    it('should delete an existing like and decrement today daily metric by 1', async () => {
      prisma.post.findFirst.mockResolvedValueOnce({
        id: 100,
        parentPostId: null,
      });

      prisma.postLike.deleteMany.mockResolvedValueOnce({
        count: 1,
      });

      prisma.postDailyMetric.upsert.mockResolvedValueOnce({
        id: 1,
      });

      const result = await service.unlikePost(1, 100);

      expect(prisma.postLike.deleteMany).toHaveBeenCalledWith({
        where: {
          postId: 100,
          userId: 1,
        },
      });

      expect(prisma.postDailyMetric.upsert).toHaveBeenCalledWith({
        where: {
          postId_metricDate: {
            postId: 100,
            metricDate: expect.any(Date),
          },
        },
        create: {
          postId: 100,
          metricDate: expect.any(Date),
          viewCount: 0,
          likeCount: -1,
        },
        update: {
          likeCount: {
            decrement: 1,
          },
        },
      });

      expect(result.message).toBe(
        'Đã bỏ thích bài viết thành công',
      );
    });

    it('should not decrement daily metric when the like does not exist', async () => {
      prisma.post.findFirst.mockResolvedValueOnce({
        id: 100,
        parentPostId: null,
      });

      /**
       * User đã unlike trước đó.
       */
      prisma.postLike.deleteMany.mockResolvedValueOnce({
        count: 0,
      });

      const result = await service.unlikePost(1, 100);

      expect(prisma.postDailyMetric.upsert).not.toHaveBeenCalled();

      expect(result.message).toBe(
        'Đã bỏ thích bài viết thành công',
      );
    });

    it('should unlike the group ROOT when called from a translation id', async () => {
      prisma.post.findFirst
        .mockResolvedValueOnce({
          id: 200,
          parentPostId: 100,
        })
        .mockResolvedValueOnce({
          id: 100,
          parentPostId: null,
        });

      prisma.postLike.deleteMany.mockResolvedValueOnce({
        count: 1,
      });

      prisma.postDailyMetric.upsert.mockResolvedValueOnce({
        id: 1,
      });

      await service.unlikePost(1, 200);

      expect(prisma.postLike.deleteMany).toHaveBeenCalledWith({
        where: {
          postId: 100,
          userId: 1,
        },
      });
    });
  });

  describe('bookmarkPost and unbookmarkPost', () => {
    it('should bookmark post successfully with upsert', async () => {
      prisma.post.findFirst.mockResolvedValueOnce({
        id: 100,
        parentPostId: null,
      });
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
      prisma.post.findFirst.mockResolvedValueOnce({
        id: 100,
        parentPostId: null,
      });
      prisma.postBookmark.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.unbookmarkPost(1, 100);
      expect(prisma.postBookmark.deleteMany).toHaveBeenCalledWith({
        where: { postId: 100, userId: 1 },
      });
      expect(result.message).toBe('Đã bỏ lưu bài viết thành công');
    });

    it('should bookmark the group ROOT when called from a translation id', async () => {
      prisma.post.findFirst
        .mockResolvedValueOnce({
          id: 200,
          parentPostId: 100,
        })
        .mockResolvedValueOnce({
          id: 100,
          parentPostId: null,
        });

      prisma.postBookmark.upsert.mockResolvedValueOnce({
        postId: 100,
        userId: 1,
        createdAt: new Date(),
      });

      const result = await service.bookmarkPost(1, 200);

      expect(prisma.postBookmark.upsert).toHaveBeenCalledWith({
        where: { postId_userId: { postId: 100, userId: 1 } },
        update: {},
        create: { postId: 100, userId: 1 },
      });
      expect(result.postId).toBe(100);
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
