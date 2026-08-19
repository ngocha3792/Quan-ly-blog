import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@app/core';

import { BlogownerOptionsService } from './blogowner-options.service';

describe('BlogownerOptionsService', () => {
  let service: BlogownerOptionsService;

  const mockPrismaService = {
    $transaction: jest.fn(),

    language: {
      findMany: jest.fn(),
    },

    category: {
      findMany: jest.fn(),
    },

    tag: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    /**
     * BlogownerOptionsService truyền một mảng Promise
     * vào prisma.$transaction().
     */
    mockPrismaService.$transaction.mockImplementation(
      async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          BlogownerOptionsService,

          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

    service =
      module.get<BlogownerOptionsService>(
        BlogownerOptionsService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return active languages, valid categories and active tags', async () => {
    const languages = [
      {
        id: 26,
        code: 'vi',
        name: 'Tiếng Việt',
        flag: '🇻🇳',
        isDefault: true,
        isActive: true,
      },
      {
        id: 27,
        code: 'en',
        name: 'English',
        flag: '🇬🇧',
        isDefault: false,
        isActive: true,
      },
    ];

    const categories = [
      {
        id: 73,
        name: 'Backend',
        languageId: 26,
        categoryGroupId: 33,

        language: {
          id: 26,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: '🇻🇳',
          isDefault: true,
          isActive: true,
        },

        categoryGroup: {
          id: 33,
          code: 'BACKEND',
        },
      },
    ];

    const tags = [
      {
        id: 46,
        name: 'NestJS',
      },
      {
        id: 47,
        name: 'TypeScript',
      },
    ];

    mockPrismaService.language.findMany
      .mockResolvedValueOnce(languages);

    mockPrismaService.category.findMany
      .mockResolvedValueOnce(categories);

    mockPrismaService.tag.findMany
      .mockResolvedValueOnce(tags);

    const result =
      await service.getPostOptions();

    expect(
      mockPrismaService.language.findMany,
    ).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        isActive: true,
      },

      select: {
        id: true,
        code: true,
        name: true,
        flag: true,
        isDefault: true,
        isActive: true,
      },

      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          code: 'asc',
        },
      ],
    });

    expect(
      mockPrismaService.category.findMany,
    ).toHaveBeenCalledWith({
      where: {
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
        name: true,
        languageId: true,
        categoryGroupId: true,

        language: {
          select: {
            id: true,
            code: true,
            name: true,
            flag: true,
            isDefault: true,
            isActive: true,
          },
        },

        categoryGroup: {
          select: {
            id: true,
            code: true,
          },
        },
      },

      orderBy: [
        {
          languageId: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });

    expect(
      mockPrismaService.tag.findMany,
    ).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },

      select: {
        id: true,
        name: true,
      },

      orderBy: {
        name: 'asc',
      },
    });

    expect(
      mockPrismaService.$transaction,
    ).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      languages,
      categories,
      tags,
    });
  });

  it('should request the default language before other active languages', async () => {
    mockPrismaService.language.findMany
      .mockResolvedValueOnce([]);

    mockPrismaService.category.findMany
      .mockResolvedValueOnce([]);

    mockPrismaService.tag.findMany
      .mockResolvedValueOnce([]);

    await service.getPostOptions();

    expect(
      mockPrismaService.language.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            isDefault: 'desc',
          },
          {
            code: 'asc',
          },
        ],
      }),
    );
  });

  it('should return empty arrays when no active options exist', async () => {
    mockPrismaService.language.findMany
      .mockResolvedValueOnce([]);

    mockPrismaService.category.findMany
      .mockResolvedValueOnce([]);

    mockPrismaService.tag.findMany
      .mockResolvedValueOnce([]);

    const result =
      await service.getPostOptions();

    expect(result).toEqual({
      languages: [],
      categories: [],
      tags: [],
    });
  });

  it('should propagate a database error', async () => {
    const databaseError =
      new Error('Database unavailable');

    mockPrismaService.language.findMany
      .mockRejectedValueOnce(databaseError);

    mockPrismaService.category.findMany
      .mockResolvedValueOnce([]);

    mockPrismaService.tag.findMany
      .mockResolvedValueOnce([]);

    await expect(
      service.getPostOptions(),
    ).rejects.toBe(databaseError);
  });
});