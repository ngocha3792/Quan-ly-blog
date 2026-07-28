import 'reflect-metadata';

import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
  CategoryGroupNotFoundException,
  PrismaService,
} from '@app/core';

import { ModeratorCategoriesService } from './moderator-categories.service';

describe('ModeratorCategoriesService', () => {
  let service: ModeratorCategoriesService;

  const date = new Date(
    '2026-07-28T00:00:00.000Z',
  );

  const baseGroup = {
    id: 10,
    code: 'programming',
    createdAt: date,
    updatedAt: date,
    deletedAt: null,

    categories: [
      {
        id: 20,
        categoryGroupId: 10,
        languageId: 4,
        name: 'Lập trình',
        createdAt: date,
        updatedAt: date,
        deletedAt: null,

        language: {
          id: 4,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: 'VN',
          createdAt: date,
          updatedAt: date,
          deletedAt: null,
        },
      },
    ],
  };

  const mockPrismaService = {
    categoryGroup: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },

    category: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },

    language: {
      findMany: jest.fn(),
    },

    postCategory: {
      count: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockPrismaService.$transaction.mockImplementation(
      async (callback) =>
        callback(mockPrismaService),
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          ModeratorCategoriesService,

          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

    service =
      module.get<ModeratorCategoriesService>(
        ModeratorCategoriesService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated category groups', async () => {
      mockPrismaService.categoryGroup.findMany
        .mockResolvedValueOnce([baseGroup]);

      mockPrismaService.categoryGroup.count
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
        mockPrismaService.categoryGroup.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
          },
          skip: 0,
          take: 10,
          orderBy: {
            code: 'asc',
          },
          include: expect.any(Object),
        }),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(10);

      expect(result.meta).toEqual({
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      });
    });

    it('should search by code or translation name', async () => {
      mockPrismaService.categoryGroup.findMany
        .mockResolvedValueOnce([baseGroup]);

      mockPrismaService.categoryGroup.count
        .mockResolvedValueOnce(1);

      await service.findAll(
        {
          search: 'lập trình',
        },
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      );

      expect(
        mockPrismaService.categoryGroup.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            OR: [
              {
                code: {
                  contains: 'lập trình',
                  mode: 'insensitive',
                },
              },
              {
                categories: {
                  some: {
                    name: {
                      contains: 'lập trình',
                      mode: 'insensitive',
                    },
                    deletedAt: null,
                  },
                },
              },
            ],
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should throw when category group does not exist', async () => {
      mockPrismaService.categoryGroup.findFirst
        .mockResolvedValueOnce(null);

      await expect(
        service.findOne(999),
      ).rejects.toThrow(
        CategoryGroupNotFoundException,
      );
    });

    it('should return category group detail', async () => {
      mockPrismaService.categoryGroup.findFirst
        .mockResolvedValueOnce(baseGroup);

      const result = await service.findOne(10);

      expect(result.id).toBe(10);
      expect(result.code).toBe('programming');
    });
  });

  describe('create', () => {
    it('should reject a duplicate category group code', async () => {
      mockPrismaService.categoryGroup.findUnique
        .mockResolvedValueOnce({
          id: 5,
          deletedAt: null,
        });

      await expect(
        service.create({
          code: 'programming',
          translations: [
            {
              languageId: 4,
              name: 'Lập trình',
            },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject an inactive or missing language', async () => {
      mockPrismaService.categoryGroup.findUnique
        .mockResolvedValueOnce(null);

      mockPrismaService.language.findMany
        .mockResolvedValueOnce([
          {
            id: 4,
          },
        ]);

      await expect(
        service.create({
          code: 'programming',
          translations: [
            {
              languageId: 4,
              name: 'Lập trình',
            },
            {
              languageId: 999,
              name: 'Programming',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a category group with translations', async () => {
      mockPrismaService.categoryGroup.findUnique
        .mockResolvedValueOnce(null);

      mockPrismaService.language.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
          },
          {
            id: 4,
          },
        ]);

      mockPrismaService.category.findFirst
        .mockResolvedValueOnce(null);

      mockPrismaService.categoryGroup.create
        .mockResolvedValueOnce(baseGroup);

      const result = await service.create({
        code: 'Programming',
        translations: [
          {
            languageId: 4,
            name: ' Lập trình ',
          },
          {
            languageId: 1,
            name: ' Programming ',
          },
        ],
      });

      expect(
        mockPrismaService.categoryGroup.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            code: 'programming',

            categories: {
              create: [
                {
                  languageId: 4,
                  name: 'Lập trình',
                },
                {
                  languageId: 1,
                  name: 'Programming',
                },
              ],
            },
          },

          include: expect.any(Object),
        }),
      );

      expect(result.id).toBe(10);
    });
  });

  describe('update', () => {
    it('should reject an empty update body', async () => {
      await expect(
        service.update(10, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upsert translations', async () => {
      mockPrismaService.categoryGroup.findFirst
        .mockResolvedValueOnce({
          id: 10,
        });

      mockPrismaService.language.findMany
        .mockResolvedValueOnce([
          {
            id: 4,
          },
        ]);

      mockPrismaService.category.findFirst
        .mockResolvedValueOnce(null);

      mockPrismaService.categoryGroup.update
        .mockResolvedValueOnce({
          id: 10,
        });

      mockPrismaService.category.upsert
        .mockResolvedValueOnce({
          id: 20,
        });

      mockPrismaService.categoryGroup.findUnique
        .mockResolvedValueOnce({
          ...baseGroup,

          categories: [
            {
              ...baseGroup.categories[0],
              name: 'Lập trình Web',
            },
          ],
        });

      const result = await service.update(10, {
        translations: [
          {
            languageId: 4,
            name: 'Lập trình Web',
          },
        ],
      });

      expect(
        mockPrismaService.category.upsert,
      ).toHaveBeenCalledWith({
        where: {
          categoryGroupId_languageId: {
            categoryGroupId: 10,
            languageId: 4,
          },
        },

        update: {
          name: 'Lập trình Web',
          deletedAt: null,
        },

        create: {
          categoryGroupId: 10,
          languageId: 4,
          name: 'Lập trình Web',
        },
      });

      expect(result.id).toBe(10);
    });
  });

  describe('remove', () => {
    it('should reject removing a group used by posts', async () => {
      mockPrismaService.categoryGroup.findFirst
        .mockResolvedValueOnce({
          id: 10,
        });

      mockPrismaService.postCategory.count
        .mockResolvedValueOnce(2);

      await expect(
        service.remove(10),
      ).rejects.toThrow(BadRequestException);

      expect(
        mockPrismaService.category.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('should soft delete group and translations', async () => {
      mockPrismaService.categoryGroup.findFirst
        .mockResolvedValueOnce({
          id: 10,
        });

      mockPrismaService.postCategory.count
        .mockResolvedValueOnce(0);

      mockPrismaService.category.updateMany
        .mockResolvedValueOnce({
          count: 1,
        });

      mockPrismaService.categoryGroup.update
        .mockResolvedValueOnce({
          ...baseGroup,
          deletedAt: date,
          categories: [],
        });

      const result = await service.remove(10);

      expect(
        mockPrismaService.category.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          categoryGroupId: 10,
          deletedAt: null,
        },

        data: {
          deletedAt: expect.any(Date),
        },
      });

      expect(
        mockPrismaService.categoryGroup.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 10,
        },

        data: {
          deletedAt: expect.any(Date),
        },

        include: expect.any(Object),
      });

      expect(result.id).toBe(10);
    });
  });
});