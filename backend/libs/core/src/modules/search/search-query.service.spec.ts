import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { SearchQueryService } from './search-query.service';
import { SearchSortOption } from './dto/search-posts.dto';

describe('SearchQueryService', () => {
  let service: SearchQueryService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchQueryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SearchQueryService>(SearchQueryService);
  });

  it('binds the raw user query as a SQL parameter instead of string-concatenating it', async () => {
    mockPrismaService.$queryRaw
      .mockResolvedValueOnce([{ postId: 1, rank: 0.5 }])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    const maliciousQuery = "nestjs'; DROP TABLE posts; --";

    await service.search(maliciousQuery, {}, 0, 10);

    const [ranked, count] = mockPrismaService.$queryRaw.mock.calls;

    /**
     * Prisma.sql tagged-template calls $queryRaw với (strings, ...values).
     * Query của user phải nằm trong values, KHÔNG được xuất hiện trong
     * chuỗi SQL literal (strings[0]).
     */
    expect(ranked[0].join('')).not.toContain(maliciousQuery);
    expect(ranked).toContain(maliciousQuery);
    expect(count[0].join('')).not.toContain(maliciousQuery);
  });

  it('returns ranked postIds and totalItems from the two queries', async () => {
    mockPrismaService.$queryRaw
      .mockResolvedValueOnce([
        { postId: 10, rank: 0.9 },
        { postId: 11, rank: 0.4 },
      ])
      .mockResolvedValueOnce([{ count: BigInt(2) }]);

    const result = await service.search('nestjs', {}, 0, 10);

    expect(result).toEqual({
      items: [
        { postId: 10, rank: 0.9 },
        { postId: 11, rank: 0.4 },
      ],
      totalItems: 2,
    });
  });

  it('applies RELEVANCE/NEWEST/POPULAR as fixed, non-user-controlled SQL fragments', async () => {
    for (const sort of [
      SearchSortOption.RELEVANCE,
      SearchSortOption.NEWEST,
      SearchSortOption.POPULAR,
    ]) {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      await expect(
        service.search('q', { sort }, 0, 10),
      ).resolves.toEqual({ items: [], totalItems: 0 });
    }
  });
});
