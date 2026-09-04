import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  LanguagesService,
  PostsService,
  SearchQueryService,
} from '@app/core';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PublicSearchService } from './public-search.service';

describe('PublicSearchService', () => {
  let service: PublicSearchService;

  const mockPrismaService = {
    post: {
      findMany: jest.fn(),
    },
  };

  const mockPostsService = {
    findAll: jest.fn(),
  };

  const mockLanguagesService = {
    getActiveIdByCode: jest.fn(),
  };

  const mockSearchQueryService = {
    search: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const paginationParams = { skip: 0, take: 10, page: 1 };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'app.searchV2Enabled') {
        return true;
      }
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicSearchService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PostsService, useValue: mockPostsService },
        { provide: LanguagesService, useValue: mockLanguagesService },
        { provide: SearchQueryService, useValue: mockSearchQueryService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PublicSearchService>(PublicSearchService);
  });

  it('falls back to title-contains search (engine CONTAINS) when SEARCH_V2_ENABLED=false', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'app.searchV2Enabled') {
        return false;
      }
      return undefined;
    });

    mockPostsService.findAll.mockResolvedValue({
      items: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: 10,
        totalPages: 0,
        currentPage: 1,
      },
    });

    const result = await service.search(
      { q: 'nestjs' } as any,
      paginationParams,
      null,
    );

    expect(mockSearchQueryService.search).not.toHaveBeenCalled();
    expect(mockPostsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'nestjs' }),
      paginationParams,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(result.search.engine).toBe('CONTAINS');
  });

  it('hydrates ranked postIds back in rank order (POSTGRES_FTS engine)', async () => {
    mockSearchQueryService.search.mockResolvedValue({
      items: [
        { postId: 20, rank: 0.9 },
        { postId: 10, rank: 0.5 },
      ],
      totalItems: 2,
    });

    mockPrismaService.post.findMany.mockResolvedValue([
      { id: 10, title: 'Bài 10' },
      { id: 20, title: 'Bài 20' },
    ]);

    const result = await service.search(
      { q: 'nestjs' } as any,
      paginationParams,
      null,
    );

    expect(result.items.map((item: any) => item.id)).toEqual([20, 10]);
    expect(result.search.engine).toBe('POSTGRES_FTS');
    expect(result.meta.totalItems).toBe(2);
  });

  it('returns an empty list without querying Prisma when there are no ranked ids', async () => {
    mockSearchQueryService.search.mockResolvedValue({
      items: [],
      totalItems: 0,
    });

    const result = await service.search(
      { q: 'không tồn tại' } as any,
      paginationParams,
      null,
    );

    expect(mockPrismaService.post.findMany).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });
});
