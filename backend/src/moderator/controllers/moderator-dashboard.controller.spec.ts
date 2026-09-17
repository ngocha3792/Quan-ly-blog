import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard, RolesGuard } from '@app/core';

import { ModeratorDashboardService } from '../services/moderator-dashboard.service';
import { ModeratorDashboardController } from './moderator-dashboard.controller';

describe('ModeratorDashboardController', () => {
  let controller: ModeratorDashboardController;

  const mockModeratorDashboardService = {
    getOverview: jest.fn(),
    getReportStats: jest.fn(),
    getReportTrend: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleBuilder = Test.createTestingModule({
      controllers: [ModeratorDashboardController],
      providers: [
        {
          provide: ModeratorDashboardService,
          useValue: mockModeratorDashboardService,
        },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller =
      module.get<ModeratorDashboardController>(
        ModeratorDashboardController,
      );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return moderator dashboard overview', async () => {
    const overview = {
      pendingPosts: 5,
      pendingReports: 3,
      pendingPostReports: 2,
      pendingCommentReports: 1,
      activeCategoryGroups: 10,
      processedToday: 7,
      processedPostsToday: 4,
      processedReportsToday: 3,
    };

    mockModeratorDashboardService.getOverview.mockResolvedValueOnce(
      overview,
    );

    await expect(
      controller.getOverview(),
    ).resolves.toEqual(overview);

    expect(
      mockModeratorDashboardService.getOverview,
    ).toHaveBeenCalledTimes(1);
  });

  it('should return moderator report statistics', async () => {
    const reportStats = {
      reportStatusCounts: {
        pending: 5,
        resolved: 3,
        rejected: 2,
      },
      reportReasonCounts: {
        spam: 1,
        harassment: 2,
        inappropriate: 3,
        copyright: 4,
        misinformation: 5,
        other: 6,
      },
    };

    mockModeratorDashboardService.getReportStats.mockResolvedValueOnce(
      reportStats,
    );

    await expect(
      controller.getReportStats(),
    ).resolves.toEqual(reportStats);

    expect(
      mockModeratorDashboardService.getReportStats,
    ).toHaveBeenCalledTimes(1);
  });

  it('should return moderator report trend', async () => {
    const reportTrend = {
      last7Days: [],
    };

    mockModeratorDashboardService.getReportTrend.mockResolvedValueOnce(
      reportTrend,
    );

    await expect(
      controller.getReportTrend(),
    ).resolves.toEqual(reportTrend);

    expect(
      mockModeratorDashboardService.getReportTrend,
    ).toHaveBeenCalledTimes(1);
  });
});
