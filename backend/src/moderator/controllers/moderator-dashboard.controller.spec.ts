import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard, RolesGuard } from '@app/core';

import { ModeratorDashboardService } from '../services/moderator-dashboard.service';
import { ModeratorDashboardController } from './moderator-dashboard.controller';

describe('ModeratorDashboardController', () => {
  let controller: ModeratorDashboardController;

  const mockModeratorDashboardService = {
    getDashboard: jest.fn(),
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

    controller = module.get<ModeratorDashboardController>(
      ModeratorDashboardController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return moderator dashboard data', async () => {
    const dashboardData = {
      overview: {
        pendingPosts: 6,
        pendingReports: 17,
        pendingPostReports: 3,
        pendingCommentReports: 14,
        activeCategoryGroups: 8,
        processedToday: 5,
        processedPostsToday: 2,
        processedReportsToday: 3,
      },

      reportStatusCounts: {
        pending: 17,
        resolved: 20,
        rejected: 5,
      },

      reportReasonCounts: {
        spam: 10,
        harassment: 8,
        inappropriate: 7,
        copyright: 2,
        misinformation: 4,
        other: 1,
      },

      last7Days: [],
    };

    mockModeratorDashboardService.getDashboard.mockResolvedValueOnce(
      dashboardData,
    );

    const result = await controller.getDashboard();

    expect(mockModeratorDashboardService.getDashboard).toHaveBeenCalledTimes(1);

    expect(result).toEqual(dashboardData);
  });
});
