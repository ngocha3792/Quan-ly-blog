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
    jest.setSystemTime(
      new Date('2026-07-28T12:00:00.000Z'),
    );
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

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

  it('should return dashboard overview and use Vietnam day boundaries', async () => {
    mockPrismaService.post.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);

    mockPrismaService.report.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(14)
      .mockResolvedValueOnce(3);

    mockPrismaService.categoryGroup.count.mockResolvedValueOnce(
      8,
    );

    const result =
      await service.getOverview();

    expect(result).toEqual({
      pendingPosts: 6,
      pendingReports: 17,
      pendingPostReports: 3,
      pendingCommentReports: 14,
      activeCategoryGroups: 8,
      processedToday: 5,
      processedPostsToday: 2,
      processedReportsToday: 3,
    });

    expect(
      mockPrismaService.post.count,
    ).toHaveBeenNthCalledWith(1, {
      where: {
        parentPostId: null,
        status:
          PostStatus.PENDING_REVIEW,
        deletedAt: null,
      },
    });

    expect(
      mockPrismaService.post.count,
    ).toHaveBeenNthCalledWith(2, {
      where: {
        parentPostId: null,
        status: {
          in: [
            PostStatus.PUBLISH,
            PostStatus.REJECT,
          ],
        },
        reviewedAt: {
          gte: new Date(
            '2026-07-27T17:00:00.000Z',
          ),
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

  it('should return report statistics and fill missing groups with zero', async () => {
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
      ])
      .mockResolvedValueOnce([
        {
          reason: ReportReason.SPAM,
          _count: {
            _all: 10,
          },
        },
        {
          reason:
            ReportReason.MISINFORMATION,
          _count: {
            _all: 4,
          },
        },
      ]);

    const result =
      await service.getReportStats();

    expect(
      result.reportStatusCounts,
    ).toEqual({
      pending: 17,
      resolved: 20,
      rejected: 0,
    });

    expect(
      result.reportReasonCounts,
    ).toEqual({
      spam: 10,
      harassment: 0,
      inappropriate: 0,
      copyright: 0,
      misinformation: 4,
      other: 0,
    });
  });

  it('should return the report trend for the last 7 Vietnam calendar days', async () => {
    mockPrismaService.report.findMany.mockResolvedValueOnce(
      [
        {
          targetType:
            ReportTargetType.POST,
          createdAt: new Date(
            '2026-07-22T01:00:00.000Z',
          ),
        },
        {
          targetType:
            ReportTargetType.COMMENT,
          createdAt: new Date(
            '2026-07-22T15:00:00.000Z',
          ),
        },
        {
          targetType:
            ReportTargetType.POST,
          createdAt: new Date(
            '2026-07-28T01:00:00.000Z',
          ),
        },
      ],
    );

    const result =
      await service.getReportTrend();

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

    expect(
      mockPrismaService.report.findMany,
    ).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date(
            '2026-07-21T17:00:00.000Z',
          ),
          lt: new Date(
            '2026-07-28T17:00:00.000Z',
          ),
        },
      },
      select: {
        targetType: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  });
});
