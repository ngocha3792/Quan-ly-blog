import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  CommentNotFoundException,
  NotCommentOwnerException,
} from '@app/core/common/exceptions';

import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    post: {
      findFirst: jest.fn(),
    },

    comment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    /*
     * resetAllMocks xóa:
     * - lịch sử gọi hàm
     * - mockResolvedValue
     * - hàng đợi mockResolvedValueOnce
     *
     * Tránh mock của test trước chạy sang test sau.
     */
    jest.resetAllMocks();

    mockPrismaService.$transaction.mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(mockPrismaService);
      }
      if (Array.isArray(cb)) {
        return Promise.all(cb);
      }
      return cb;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const userId = 1;

    it('should reject comments on a post that is not published', async () => {
      const createDto: any = {
        postId: 1,
        content: 'Test comment',
      };

      /*
       * Không tìm thấy bài PUBLISH và chưa bị xóa.
       */
      mockPrismaService.post.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create(userId, createDto),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('should throw CommentNotFoundException if parent comment not found', async () => {
      const createDto: any = {
        postId: 1,
        content: 'Test reply',
        parentId: 999,
      };

      /*
       * Bài viết hợp lệ.
       */
      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
      });

      /*
       * Không tìm thấy comment cha.
       */
      mockPrismaService.comment.findFirst.mockResolvedValueOnce(
        null,
      );

      await expect(
        service.create(userId, createDto),
      ).rejects.toThrow(CommentNotFoundException);

      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('should reject a parent comment from another post', async () => {
      const createDto: any = {
        postId: 1,
        content: 'Test reply',
        parentId: 5,
      };

      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
      });

      /*
       * Comment cha thuộc postId = 2,
       * trong khi comment mới thuộc postId = 1.
       */
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 5,
        postId: 2,
        parentId: null,
        deletedAt: null,
      });

      await expect(
        service.create(userId, createDto),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('should flatten comment tree if parent comment is already a reply', async () => {
      const createDto: any = {
        postId: 1,
        content: 'Test reply',
        parentId: 2,
      };

      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
      });

      /*
       * Comment 2 là reply của comment gốc 1.
       * Comment mới sẽ được gắn vào comment gốc 1.
       */
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 2,
        postId: 1,
        parentId: 1,
        deletedAt: null,
      });

      mockPrismaService.comment.create.mockResolvedValueOnce({
        id: 3,
        postId: 1,
        userId,
        parentId: 1,
        content: 'Test reply',
      });

      const result = await service.create(userId, createDto);

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          postId: 1,
          userId,
          parentId: 1,
          content: 'Test reply',
        },
      });

      expect(result.id).toBe(3);
    });

    it('should create a root comment if no parentId is provided', async () => {
      const createDto: any = {
        postId: 1,
        content: 'Root comment',
      };

      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
      });

      mockPrismaService.comment.create.mockResolvedValueOnce({
        id: 1,
        postId: 1,
        userId,
        parentId: null,
        content: 'Root comment',
      });

      const result = await service.create(userId, createDto);

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          postId: 1,
          userId,
          parentId: null,
          content: 'Root comment',
        },
      });

      expect(result.id).toBe(1);
    });
  });

  describe('findAll', () => {
    it('should return paginated comments without filters', async () => {
      mockPrismaService.comment.findMany.mockResolvedValueOnce([
        {
          id: 1,
        },
      ]);

      mockPrismaService.comment.count.mockResolvedValueOnce(1);

      const result = await service.findAll(
        {},
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      );

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
        skip: 0,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result.items.length).toBe(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.currentPage).toBe(1);
    });

    it('should return paginated comments with filters', async () => {
      mockPrismaService.comment.findMany.mockResolvedValueOnce([
        {
          id: 1,
        },
      ]);

      mockPrismaService.comment.count.mockResolvedValueOnce(1);

      const query: any = {
        postId: 1,
        parentId: null,
        userId: 1,
      };

      const result = await service.findAll(query, {
        skip: 0,
        take: 10,
        page: 1,
      });

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          postId: 1,
          parentId: null,
          userId: 1,
        },
        skip: 0,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result.meta.totalItems).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should throw CommentNotFoundException if comment not found', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce(
        null,
      );

      await expect(service.findOne(999)).rejects.toThrow(
        CommentNotFoundException,
      );
    });

    it('should return comment if found', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 1,
        postId: 1,
        userId: 1,
        parentId: null,
        content: 'Test comment',
      });

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
    });
  });

  describe('update', () => {
    const userId = 1;

    const updateDto: any = {
      content: 'Updated comment',
    };

    it('should throw NotCommentOwnerException if user is not the owner', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 1,
        postId: 1,
        userId: 2,
        parentId: null,
        content: 'Old comment',
      });

      await expect(
        service.update(1, userId, updateDto),
      ).rejects.toThrow(NotCommentOwnerException);

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('should update only content if user is the owner', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 1,
        postId: 1,
        userId,
        parentId: null,
        content: 'Old comment',
      });

      mockPrismaService.comment.update.mockResolvedValueOnce({
        id: 1,
        postId: 1,
        userId,
        parentId: null,
        content: 'Updated comment',
      });

      const result = await service.update(
        1,
        userId,
        updateDto,
      );

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
        data: {
          content: 'Updated comment',
        },
      });

      expect(result.id).toBe(1);
      expect(result.content).toBe('Updated comment');
    });
  });

  describe('remove', () => {
    const userId = 1;

    it('should throw NotCommentOwnerException if user is not the owner', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 1,
        postId: 1,
        userId: 2,
        parentId: null,
        content: 'Test comment',
      });

      await expect(
        service.remove(1, userId),
      ).rejects.toThrow(NotCommentOwnerException);

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('should soft delete comment and its child replies if user is the owner', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 1,
        postId: 1,
        userId,
        parentId: null,
        content: 'Test comment',
      });

      mockPrismaService.comment.update.mockResolvedValueOnce({
        id: 1,
        postId: 1,
        userId,
        parentId: null,
        content: 'Test comment',
        deletedAt: new Date(),
      });
      mockPrismaService.comment.updateMany.mockResolvedValueOnce({ count: 2 });

      const result = await service.remove(1, userId);

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      });

      expect(prisma.comment.updateMany).toHaveBeenCalledWith({
        where: {
          parentId: 1,
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      });

      expect(result.id).toBe(1);
    });
  });
});


// import { Test, TestingModule } from '@nestjs/testing';
// import { CommentsService } from './comments.service';
// import { PrismaService } from '@app/core/core/prisma/prisma.service';
// import {
//   CommentNotFoundException,
//   NotCommentOwnerException,
// } from '@app/core/common/exceptions';

// describe('CommentsService', () => {
//   let service: CommentsService;
//   let prisma: PrismaService;

//   const mockPrismaService = {
//     comment: {
//       findFirst: jest.fn(),
//       create: jest.fn(),
//       findMany: jest.fn(),
//       count: jest.fn(),
//       update: jest.fn(),
//     },
//   };

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         CommentsService,
//         { provide: PrismaService, useValue: mockPrismaService },
//       ],
//     }).compile();

//     service = module.get<CommentsService>(CommentsService);
//     prisma = module.get<PrismaService>(PrismaService);
//   });

//   afterEach(() => {
//     jest.clearAllMocks();
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('create', () => {
//     const userId = 1;

//     it('should throw CommentNotFoundException if parent comment not found', async () => {
//       const createDto: any = { content: 'test', parentId: 999 };
//       mockPrismaService.comment.findFirst.mockResolvedValueOnce(null);

//       await expect(service.create(userId, createDto)).rejects.toThrow(
//         CommentNotFoundException,
//       );
//     });

//     it('should flatten comment tree if parent comment has a parentId (level 2+)', async () => {
//       const createDto: any = { content: 'test', parentId: 2 };
//       // Parent is already a reply (has parentId = 1)
//       mockPrismaService.comment.findFirst.mockResolvedValueOnce({
//         id: 2,
//         parentId: 1,
//         deletedAt: null,
//       });
//       mockPrismaService.comment.create.mockResolvedValueOnce({
//         id: 3,
//         parentId: 1,
//         userId,
//       });

//       const result = await service.create(userId, createDto);

//       expect(prisma.comment.create).toHaveBeenCalledWith({
//         data: { ...createDto, parentId: 1, userId },
//       });
//       expect(result.id).toBe(3);
//     });

//     it('should create a root comment if no parentId', async () => {
//       const createDto: any = { content: 'root' };
//       mockPrismaService.comment.create.mockResolvedValueOnce({
//         id: 1,
//         parentId: undefined,
//         userId,
//       });

//       const result = await service.create(userId, createDto);

//       expect(prisma.comment.create).toHaveBeenCalledWith({
//         data: { ...createDto, parentId: undefined, userId },
//       });
//       expect(result.id).toBe(1);
//     });
//   });

//   describe('findAll', () => {
//     it('should return paginated comments without filters', async () => {
//       mockPrismaService.comment.findMany.mockResolvedValueOnce([{ id: 1 }]);
//       mockPrismaService.comment.count.mockResolvedValueOnce(1);

//       const result = await service.findAll({}, { skip: 0, take: 10, page: 1 });

//       expect(prisma.comment.findMany).toHaveBeenCalledWith({
//         where: { deletedAt: null },
//         skip: 0,
//         take: 10,
//         orderBy: { createdAt: 'desc' },
//       });
//       expect(result.items.length).toBe(1);
//     });

//     it('should return paginated comments with filters', async () => {
//       mockPrismaService.comment.findMany.mockResolvedValueOnce([{ id: 1 }]);
//       mockPrismaService.comment.count.mockResolvedValueOnce(1);

//       const query: any = { postId: 1, parentId: null, userId: 1 };
//       const result = await service.findAll(query, {
//         skip: 0,
//         take: 10,
//         page: 1,
//       });

//       expect(prisma.comment.findMany).toHaveBeenCalledWith({
//         where: { deletedAt: null, postId: 1, parentId: null, userId: 1 },
//         skip: 0,
//         take: 10,
//         orderBy: { createdAt: 'desc' },
//       });
//       expect(result.meta.totalItems).toBe(1);
//     });
//   });

//   describe('findOne', () => {
//     it('should throw CommentNotFoundException if comment not found', async () => {
//       mockPrismaService.comment.findFirst.mockResolvedValueOnce(null);
//       await expect(service.findOne(999)).rejects.toThrow(
//         CommentNotFoundException,
//       );
//     });

//     it('should return comment if found', async () => {
//       mockPrismaService.comment.findFirst.mockResolvedValueOnce({ id: 1 });
//       const result = await service.findOne(1);
//       expect(result.id).toBe(1);
//     });
//   });

//   describe('update', () => {
//     const updateDto: any = { content: 'updated' };
//     const userId = 1;

//     it('should throw NotCommentOwnerException if user is not the owner', async () => {
//       mockPrismaService.comment.findFirst.mockResolvedValueOnce({
//         id: 1,
//         userId: 2,
//       });
//       await expect(service.update(1, userId, updateDto)).rejects.toThrow(
//         NotCommentOwnerException,
//       );
//     });

//     it('should update successfully if user is the owner', async () => {
//       mockPrismaService.comment.findFirst.mockResolvedValueOnce({
//         id: 1,
//         userId,
//       });
//       mockPrismaService.comment.update.mockResolvedValueOnce({
//         id: 1,
//         content: 'updated',
//         userId,
//       });

//       const result = await service.update(1, userId, updateDto);

//       expect(prisma.comment.update).toHaveBeenCalledWith({
//         where: { id: 1 },
//         data: updateDto,
//       });
//       expect(result.id).toBe(1);
//     });
//   });

//   describe('remove', () => {
//     const userId = 1;

//     it('should throw NotCommentOwnerException if user is not the owner', async () => {
//       mockPrismaService.comment.findFirst.mockResolvedValueOnce({
//         id: 1,
//         userId: 2,
//       });
//       await expect(service.remove(1, userId)).rejects.toThrow(
//         NotCommentOwnerException,
//       );
//     });

//     it('should soft delete successfully if user is the owner', async () => {
//       mockPrismaService.comment.findFirst.mockResolvedValueOnce({
//         id: 1,
//         userId,
//       });
//       mockPrismaService.comment.update.mockResolvedValueOnce({
//         id: 1,
//         deletedAt: new Date(),
//         userId,
//       });

//       const result = await service.remove(1, userId);

//       expect(prisma.comment.update).toHaveBeenCalledWith({
//         where: { id: 1 },
//         data: { deletedAt: expect.any(Date) },
//       });
//       expect(result.id).toBe(1);
//     });
//   });
// });
