import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus } from '@prisma/client';

import {
  PostNotFoundException,
} from '@app/core/common/exceptions';
import { PrismaService } from '@app/core/core/prisma/prisma.service';

import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    post: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },

    language: {
      findFirst: jest.fn(),
    },

    category: {
      findMany: jest.fn(),
    },

    tag: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
    },

    postLike: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },

    postBookmark: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    /**
     * Mặc định language ID 1 tồn tại và đang active.
     * Các test lỗi language sẽ override bằng
     * mockResolvedValueOnce(null).
     */
    mockPrismaService.language.findFirst.mockResolvedValue({
      id: 1,
    });

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          PostsService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

    service = module.get<PostsService>(
      PostsService,
    );

    prisma = module.get<PrismaService>(
      PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const authorId = 1;

    it('should create a post without tags', async () => {
      const createDto = {
        title: 'Test Post',
        content: 'Content',
        languageId: 1,
        categoryIds: [1],
      };

      mockPrismaService.category.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
          },
        ]);

      mockPrismaService.post.create
        .mockResolvedValueOnce({
          id: 1,
          title: 'Test Post',
          content: 'Content',
          languageId: 1,
          authorId,
          status: PostStatus.DRAFT,

          postCategories: [
            {
              category: {
                id: 1,
              },
            },
          ],

          postTags: [],
        });

      const result = await service.create(
        authorId,
        createDto,
      );

      expect(
        mockPrismaService.language.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 1,
          deletedAt: null,
          isActive: true,
        },

        select: {
          id: true,
        },
      });

      expect(
        mockPrismaService.category.findMany,
      ).toHaveBeenCalledWith({
        where: {
          id: {
            in: [1],
          },

          languageId: 1,
          deletedAt: null,

          language: {
            deletedAt: null,
            isActive: true,
          },

          categoryGroup: {
            deletedAt: null,
          },
        },

        select: {
          id: true,
        },
      });

      expect(
        mockPrismaService.tag.findMany,
      ).not.toHaveBeenCalled();

      expect(
        mockPrismaService.tag.createMany,
      ).not.toHaveBeenCalled();

      expect(
        prisma.post.create,
      ).toHaveBeenCalledWith({
        data: {
          title: 'Test Post',
          content: 'Content',
          languageId: 1,
          authorId,
          status: PostStatus.DRAFT,

          postCategories: {
            create: [
              {
                categoryId: 1,
              },
            ],
          },
        },

        include: {
          postCategories: {
            include: {
              category: true,
            },
          },

          postTags: {
            include: {
              tag: true,
            },
          },
        },
      });

      expect(result.id).toBe(1);
    });

    it('should resolve tags and create a post with postTags', async () => {
      const createDto = {
        title: 'Test Post',
        content: 'Content',
        languageId: 1,
        categoryIds: [1],
        tagIds: [1],
        tagNames: ['new-tag'],
      };

      mockPrismaService.category.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
          },
        ]);

      mockPrismaService.tag.findMany
        /**
         * Lần 1:
         * Validate tagIds [1].
         */
        .mockResolvedValueOnce([
          {
            id: 1,
          },
        ])

        /**
         * Lần 2:
         * Tìm tagNames trước khi tạo.
         * new-tag chưa tồn tại.
         */
        .mockResolvedValueOnce([])

        /**
         * Lần 3:
         * Query lại sau createMany để lấy ID.
         */
        .mockResolvedValueOnce([
          {
            id: 2,
          },
        ]);

      mockPrismaService.tag.createMany
        .mockResolvedValueOnce({
          count: 1,
        });

      mockPrismaService.post.create
        .mockResolvedValueOnce({
          id: 1,
          title: 'Test Post',
          content: 'Content',
          languageId: 1,
          authorId,
          status: PostStatus.DRAFT,

          postCategories: [
            {
              category: {
                id: 1,
              },
            },
          ],

          postTags: [
            {
              tag: {
                id: 1,
                name: 'existing-tag',
              },
            },
            {
              tag: {
                id: 2,
                name: 'new-tag',
              },
            },
          ],
        });

      const result = await service.create(
        authorId,
        createDto,
      );

      expect(
        mockPrismaService.tag.findMany,
      ).toHaveBeenNthCalledWith(1, {
        where: {
          id: {
            in: [1],
          },
          deletedAt: null,
        },

        select: {
          id: true,
        },
      });

      expect(
        mockPrismaService.tag.findMany,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          name: {
            in: ['new-tag'],
          },
        },

        select: {
          id: true,
          name: true,
          deletedAt: true,
        },
      });

      expect(
        mockPrismaService.tag.findMany,
      ).toHaveBeenNthCalledWith(3, {
        where: {
          name: {
            in: ['new-tag'],
          },
          deletedAt: null,
        },

        select: {
          id: true,
        },
      });

      expect(
        prisma.tag.createMany,
      ).toHaveBeenCalledWith({
        data: [
          {
            name: 'new-tag',
          },
        ],
        skipDuplicates: true,
      });

      expect(
        prisma.post.create,
      ).toHaveBeenCalledWith({
        data: {
          title: 'Test Post',
          content: 'Content',
          languageId: 1,
          authorId,
          status: PostStatus.DRAFT,

          postCategories: {
            create: [
              {
                categoryId: 1,
              },
            ],
          },

          postTags: {
            create: [
              {
                tagId: 1,
              },
              {
                tagId: 2,
              },
            ],
          },
        },

        include: {
          postCategories: {
            include: {
              category: true,
            },
          },

          postTags: {
            include: {
              tag: true,
            },
          },
        },
      });

      expect(result.id).toBe(1);
    });

    it('should reject creating a post with an inactive language', async () => {
      const createDto = {
        title: 'Test Post',
        content: 'Content',
        languageId: 99,
        categoryIds: [1],
      };

      mockPrismaService.language.findFirst
        .mockResolvedValueOnce(null);

      await expect(
        service.create(
          authorId,
          createDto,
        ),
      ).rejects.toThrow(
        'Ngôn ngữ không tồn tại, đã bị xóa hoặc đang bị vô hiệu hóa.',
      );

      expect(
        mockPrismaService.language.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 99,
          deletedAt: null,
          isActive: true,
        },

        select: {
          id: true,
        },
      });

      expect(
        mockPrismaService.category.findMany,
      ).not.toHaveBeenCalled();

      expect(
        mockPrismaService.post.create,
      ).not.toHaveBeenCalled();
    });

    it('should reject a category that is invalid, deleted, in an inactive language or deleted group', async () => {
      const createDto = {
        title: 'Test Post',
        content: 'Content',
        languageId: 1,
        categoryIds: [99],
      };

      mockPrismaService.category.findMany
        .mockResolvedValueOnce([]);

      await expect(
        service.create(
          authorId,
          createDto,
        ),
      ).rejects.toThrow(
        'Có danh mục không tồn tại, đã bị xóa, thuộc nhóm đã bị xóa hoặc không cùng ngôn ngữ với bài viết.',
      );

      expect(
        mockPrismaService.category.findMany,
      ).toHaveBeenCalledWith({
        where: {
          id: {
            in: [99],
          },

          languageId: 1,
          deletedAt: null,

          language: {
            deletedAt: null,
            isActive: true,
          },

          categoryGroup: {
            deletedAt: null,
          },
        },

        select: {
          id: true,
        },
      });

      expect(
        mockPrismaService.post.create,
      ).not.toHaveBeenCalled();
    });

    it('should reject a tag ID that does not exist or was soft-deleted', async () => {
      const createDto = {
        title: 'Test Post',
        content: 'Content',
        languageId: 1,
        categoryIds: [1],
        tagIds: [99],
      };

      mockPrismaService.category.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
          },
        ]);

      mockPrismaService.tag.findMany
        .mockResolvedValueOnce([]);

      await expect(
        service.create(
          authorId,
          createDto,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Có thẻ không tồn tại hoặc đã bị xóa.',
        ),
      );

      expect(
        mockPrismaService.tag.findMany,
      ).toHaveBeenCalledWith({
        where: {
          id: {
            in: [99],
          },
          deletedAt: null,
        },

        select: {
          id: true,
        },
      });

      expect(
        mockPrismaService.tag.createMany,
      ).not.toHaveBeenCalled();

      expect(
        mockPrismaService.post.create,
      ).not.toHaveBeenCalled();
    });

    it('should reject a tag name that belongs to a soft-deleted tag', async () => {
      const createDto = {
        title: 'Test Post',
        content: 'Content',
        languageId: 1,
        categoryIds: [1],
        tagNames: ['old-tag'],
      };

      mockPrismaService.category.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
          },
        ]);

      mockPrismaService.tag.findMany
        .mockResolvedValueOnce([
          {
            id: 5,
            name: 'old-tag',
            deletedAt: new Date(
              '2026-07-30T00:00:00.000Z',
            ),
          },
        ]);

      await expect(
        service.create(
          authorId,
          createDto,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Không thể sử dụng thẻ đã bị xóa: old-tag.',
        ),
      );

      expect(
        mockPrismaService.tag.findMany,
      ).toHaveBeenCalledWith({
        where: {
          name: {
            in: ['old-tag'],
          },
        },

        select: {
          id: true,
          name: true,
          deletedAt: true,
        },
      });

      expect(
        mockPrismaService.tag.createMany,
      ).not.toHaveBeenCalled();

      expect(
        mockPrismaService.post.create,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated posts without filters', async () => {
      mockPrismaService.post.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
          },
        ]);

      mockPrismaService.post.count
        .mockResolvedValueOnce(1);

      const result = await service.findAll(
        {},
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      );

      expect(
        prisma.post.findMany,
      ).toHaveBeenCalledWith({
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
    });

    it('should apply various filters including tagName', async () => {
      mockPrismaService.tag.findFirst
        .mockResolvedValueOnce({
          id: 99,
        });

      mockPrismaService.post.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
          },
        ]);

      mockPrismaService.post.count
        .mockResolvedValueOnce(1);

      const query: any = {
        search: 'Test',
        tagName: 'tag',
        bookmarkedByUserId: 1,
      };

      await service.findAll(
        query,
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      );

      expect(
        prisma.post.findMany,
      ).toHaveBeenCalledWith({
        where: expect.objectContaining({
          title: {
            contains: 'Test',
            mode: 'insensitive',
          },

          postTags: {
            some: {
              tagId: 99,
            },
          },

          postBookmarks: {
            some: {
              userId: 1,
            },
          },
        }),

        skip: 0,
        take: 10,

        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should handle tagName not found by setting impossible condition', async () => {
      mockPrismaService.tag.findFirst
        .mockResolvedValueOnce(null);

      mockPrismaService.post.findMany
        .mockResolvedValueOnce([]);

      mockPrismaService.post.count
        .mockResolvedValueOnce(0);

      const query: any = {
        tagName: 'missing',
      };

      await service.findAll(
        query,
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      );

      expect(
        prisma.post.findMany,
      ).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: -1,
        }),

        skip: 0,
        take: 10,

        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should throw PostNotFoundException if post not found', async () => {
      mockPrismaService.post.findFirst
        .mockResolvedValueOnce(null);

      await expect(
        service.findOne(999),
      ).rejects.toThrow(
        PostNotFoundException,
      );
    });

    it('should return post if found', async () => {
      mockPrismaService.post.findFirst
        .mockResolvedValueOnce({
          id: 1,
        });

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
    });
  });

  describe('update', () => {
    it('should update a post and resolve tags', async () => {
      mockPrismaService.post.findFirst
        .mockResolvedValueOnce({
          id: 1,
          languageId: 1,
        });

      mockPrismaService.tag.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
          },
        ]);

      mockPrismaService.post.update
        .mockResolvedValueOnce({
          id: 1,
        });

      const updateDto: any = {
        title: 'Updated',
        tagIds: [1],
      };

      await service.update(
        1,
        updateDto,
      );

      expect(
        mockPrismaService.tag.findMany,
      ).toHaveBeenCalledWith({
        where: {
          id: {
            in: [1],
          },
          deletedAt: null,
        },

        select: {
          id: true,
        },
      });

      expect(
        prisma.post.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 1,
        },

        data: expect.objectContaining({
          title: 'Updated',

          postTags: {
            deleteMany: {},
            create: [
              {
                tagId: 1,
              },
            ],
          },
        }),

        include: {
          postCategories: {
            include: {
              category: true,
            },
          },

          postTags: {
            include: {
              tag: true,
            },
          },
        },
      });
    });

    it('should reject changing to an inactive language', async () => {
      mockPrismaService.post.findFirst
        .mockResolvedValueOnce({
          id: 1,
          languageId: 1,
        });

      mockPrismaService.language.findFirst
        .mockResolvedValueOnce(null);

      const updateDto: any = {
        languageId: 99,
        categoryIds: [2],
      };

      await expect(
        service.update(
          1,
          updateDto,
        ),
      ).rejects.toThrow(
        'Ngôn ngữ không tồn tại, đã bị xóa hoặc đang bị vô hiệu hóa.',
      );

      expect(
        mockPrismaService.language.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 99,
          deletedAt: null,
          isActive: true,
        },

        select: {
          id: true,
        },
      });

      expect(
        mockPrismaService.category.findMany,
      ).not.toHaveBeenCalled();

      expect(
        mockPrismaService.post.update,
      ).not.toHaveBeenCalled();
    });

    it('should require categoryIds when changing post language', async () => {
      mockPrismaService.post.findFirst
        .mockResolvedValueOnce({
          id: 1,
          languageId: 1,
        });

      const updateDto: any = {
        languageId: 2,
      };

      await expect(
        service.update(
          1,
          updateDto,
        ),
      ).rejects.toThrow(
        'Khi đổi ngôn ngữ bài viết, bạn phải gửi lại categoryIds phù hợp với ngôn ngữ mới.',
      );

      expect(
        mockPrismaService.language.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 2,
          deletedAt: null,
          isActive: true,
        },

        select: {
          id: true,
        },
      });

      expect(
        mockPrismaService.category.findMany,
      ).not.toHaveBeenCalled();

      expect(
        mockPrismaService.post.update,
      ).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete post', async () => {
      mockPrismaService.post.findFirst
        .mockResolvedValueOnce({
          id: 1,
        });

      mockPrismaService.post.update
        .mockResolvedValueOnce({
          id: 1,
        });

      await service.remove(1);

      expect(
        prisma.post.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 1,
        },

        data: {
          deletedAt: expect.any(Date),
        },
      });
    });
  });
});