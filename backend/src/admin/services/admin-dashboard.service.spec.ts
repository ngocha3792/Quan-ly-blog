import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/core';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;

  const mockPrismaService = {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    language: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    blogOwnerRequest: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-30T03:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    mockPrismaService.$transaction.mockImplementation(
      async (operations: Promise<unknown>[]) => Promise.all(operations),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should aggregate admin dashboard statistics correctly', async () => {
      // Mock count returns:
      // 1. totalUsers
      // 2. totalBlogOwners
      // 3. totalLanguages
      // 4. pendingRequests
      mockPrismaService.user.count
        .mockResolvedValueOnce(320)
        .mockResolvedValueOnce(42);

      mockPrismaService.language.count.mockResolvedValueOnce(3);

      mockPrismaService.blogOwnerRequest.count.mockResolvedValueOnce(5);

      // Mock recent users (7-day user growth)
      mockPrismaService.user.findMany.mockResolvedValueOnce([
        { createdAt: new Date('2026-07-30T01:00:00.000Z') },
        { createdAt: new Date('2026-07-30T02:00:00.000Z') },
      ]);

      // Mock language distribution
      mockPrismaService.language.findMany.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Tiếng Việt',
          code: 'vi',
          flag: 'VN',
          _count: { posts: 60 },
        },
        {
          id: 2,
          name: 'English',
          code: 'en',
          flag: 'US',
          _count: { posts: 30 },
        },
      ]);

      const result = await service.getDashboard();

      expect(result.stats).toEqual({
        totalUsers: 320,
        totalBlogOwners: 42,
        totalLanguages: 3,
        pendingRequests: 5,
      });

      expect(result.userGrowth.labels).toHaveLength(7);
      expect(result.userGrowth.data).toHaveLength(7);

      expect(result.postsByLanguage.labels).toEqual(['Tiếng Việt', 'English']);
      expect(result.postsByLanguage.data).toEqual([60, 30]);
      expect(result.postsByLanguage.details[0]).toEqual({
        id: 1,
        name: 'Tiếng Việt',
        code: 'vi',
        flag: 'VN',
        postCount: 60,
        percentage: 66.7,
      });
    });
  });
});
