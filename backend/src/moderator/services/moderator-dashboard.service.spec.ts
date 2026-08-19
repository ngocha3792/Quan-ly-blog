import {
  PostStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@app/core';

import { ModeratorDashboardService } from './moderator-dashboard.service';

describe('ModeratorDashboardService', () => {
  let service: ModeratorDashboardService;

  const mockPrismaService = {
    post: {
      count: jest.fn(),
    },

    report: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },

    categoryGroup: {
      count: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  beforeAll(() => {
    jest.useFakeTimers();

    /**
     * Thời điểm này tương ứng:
     * 19:00 ngày 28/07/2026 tại Việt Nam.
     */
    jest.setSystemTime(
      new Date('2026-07-28T12:00:00.000Z'),
    );
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    /**
     * Với transaction dạng mảng,
     * Prisma sẽ trả kết quả theo đúng thứ tự.
     */
    mockPrismaService.$transaction.mockImplementation(
      async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          ModeratorDashboardService,

          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

    service =
      module.get<ModeratorDashboardService>(
        ModeratorDashboardService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return moderator dashboard statistics', async () => {
    /**
     * post.count:
     * 1. pendingPosts
     * 2. processedPostsToday
     */
    mockPrismaService.post.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);

    /**
     * report.count:
     * 1. pendingPostReports
     * 2. pendingCommentReports
     * 3. processedReportsToday
     */
    mockPrismaService.report.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(14)
      .mockResolvedValueOnce(3);

    mockPrismaService.categoryGroup.count
      .mockResolvedValueOnce(8);

    /**
     * report.groupBy lần 1: theo status.
     */
    mockPrismaService.report.groupBy
      .mockResolvedValueOnce([
        {
          status: ReportStatus.PENDING,
          _count: {
            _all: 17,
          },
        },
        {
          status: ReportStatus.RESOLVED,
          _count: {
            _all: 20,
          },
        },
        {
          status: ReportStatus.REJECTED,
          _count: {
            _all: 5,
          },
        },
      ])

      /**
       * report.groupBy lần 2: theo reason.
       */
      .mockResolvedValueOnce([
        {
          reason: ReportReason.SPAM,
          _count: {
            _all: 10,
          },
        },
        {
          reason: ReportReason.HARASSMENT,
          _count: {
            _all: 8,
          },
        },
        {
          reason: ReportReason.INAPPROPRIATE,
          _count: {
            _all: 7,
          },
        },
        {
          reason: ReportReason.COPYRIGHT,
          _count: {
            _all: 2,
          },
        },
        {
          reason: ReportReason.MISINFORMATION,
          _count: {
            _all: 4,
          },
        },
        {
          reason: ReportReason.OTHER,
          _count: {
            _all: 1,
          },
        },
      ]);

    mockPrismaService.report.findMany
      .mockResolvedValueOnce([
        /**
         * 08:00 ngày 22/07 tại Việt Nam.
         */
        {
          targetType: ReportTargetType.POST,
          createdAt: new Date(
            '2026-07-22T01:00:00.000Z',
          ),
        },

        /**
         * 22:00 ngày 22/07 tại Việt Nam.
         */
        {
          targetType:
            ReportTargetType.COMMENT,
          createdAt: new Date(
            '2026-07-22T15:00:00.000Z',
          ),
        },

        /**
         * 08:00 ngày 28/07 tại Việt Nam.
         */
        {
          targetType: ReportTargetType.POST,
          createdAt: new Date(
            '2026-07-28T01:00:00.000Z',
          ),
        },
      ]);

    const result = await service.getDashboard();

    expect(result.overview).toEqual({
      pendingPosts: 6,
      pendingReports: 17,
      pendingPostReports: 3,
      pendingCommentReports: 14,
      activeCategoryGroups: 8,
      processedToday: 5,
      processedPostsToday: 2,
      processedReportsToday: 3,
    });

    expect(result.reportStatusCounts).toEqual({
      pending: 17,
      resolved: 20,
      rejected: 5,
    });

    expect(result.reportReasonCounts).toEqual({
      spam: 10,
      harassment: 8,
      inappropriate: 7,
      copyright: 2,
      misinformation: 4,
      other: 1,
    });

    expect(result.last7Days).toEqual([
      {
        date: '2026-07-22',
        postReports: 1,
        commentReports: 1,
        totalReports: 2,
      },
      {
        date: '2026-07-23',
        postReports: 0,
        commentReports: 0,
        totalReports: 0,
      },
      {
        date: '2026-07-24',
        postReports: 0,
        commentReports: 0,
        totalReports: 0,
      },
      {
        date: '2026-07-25',
        postReports: 0,
        commentReports: 0,
        totalReports: 0,
      },
      {
        date: '2026-07-26',
        postReports: 0,
        commentReports: 0,
        totalReports: 0,
      },
      {
        date: '2026-07-27',
        postReports: 0,
        commentReports: 0,
        totalReports: 0,
      },
      {
        date: '2026-07-28',
        postReports: 1,
        commentReports: 0,
        totalReports: 1,
      },
    ]);
  });

  it('should return zero for missing status and reason groups', async () => {
    mockPrismaService.post.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrismaService.report.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrismaService.categoryGroup.count
      .mockResolvedValueOnce(0);

    mockPrismaService.report.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockPrismaService.report.findMany
      .mockResolvedValueOnce([]);

    const result = await service.getDashboard();

    expect(result.reportStatusCounts).toEqual({
      pending: 0,
      resolved: 0,
      rejected: 0,
    });

    expect(result.reportReasonCounts).toEqual({
      spam: 0,
      harassment: 0,
      inappropriate: 0,
      copyright: 0,
      misinformation: 0,
      other: 0,
    });

    expect(result.last7Days).toHaveLength(7);

    expect(
      result.last7Days.every(
        (day) => day.totalReports === 0,
      ),
    ).toBe(true);
  });

  it('should query today using Vietnam time boundaries', async () => {
    mockPrismaService.post.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrismaService.report.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrismaService.categoryGroup.count
      .mockResolvedValueOnce(0);

    mockPrismaService.report.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockPrismaService.report.findMany
      .mockResolvedValueOnce([]);

    await service.getDashboard();

    expect(
      mockPrismaService.post.count,
    ).toHaveBeenNthCalledWith(2, {
      where: {
        status: {
          in: [
            PostStatus.PUBLISH,
            PostStatus.REJECT,
          ],
        },

        reviewedAt: {
          /**
           * 00:00 ngày 28/07 Việt Nam.
           */
          gte: new Date(
            '2026-07-27T17:00:00.000Z',
          ),

          /**
           * 00:00 ngày 29/07 Việt Nam.
           */
          lt: new Date(
            '2026-07-28T17:00:00.000Z',
          ),
        },

        reviewedById: {
          not: null,
        },

        deletedAt: null,
      },
    });
  });
});