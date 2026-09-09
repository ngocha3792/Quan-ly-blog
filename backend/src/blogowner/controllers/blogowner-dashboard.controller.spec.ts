import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard, RolesGuard } from '@app/core';

import { BlogownerDashboardService } from '../services/blogowner-dashboard.service';
import { BlogownerDashboardController } from './blogowner-dashboard.controller';

describe('BlogownerDashboardController', () => {
  let controller: BlogownerDashboardController;

  const mockBlogownerDashboardService = {
    getDashboard: jest.fn(),
    getSummary: jest.fn(),
    getActivity: jest.fn(),
    getFeatured: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogownerDashboardController],

      providers: [
        {
          provide: BlogownerDashboardService,
          useValue: mockBlogownerDashboardService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<BlogownerDashboardController>(
      BlogownerDashboardController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return dashboard summary', async () => {
    const user = {
      id: 99,
    } as any;

    const summary = {
      postCounts: {
        total: 4,
        draft: 1,
        pendingReview: 1,
        published: 1,
        rejected: 1,
      },
      totals: {
        views: 450,
        likes: 80,
        comments: 15,
      },
    };

    mockBlogownerDashboardService.getSummary.mockResolvedValueOnce(
      summary,
    );

    await expect(controller.getSummary(user)).resolves.toEqual(
      summary,
    );

    expect(
      mockBlogownerDashboardService.getSummary,
    ).toHaveBeenCalledWith(99);
  });

  it('should return dashboard activity with requested days', async () => {
    const user = {
      id: 99,
    } as any;

    const query = {
      days: 7,
    };

    const activity = {
      days: 7,
      last7Days: [],
    };

    mockBlogownerDashboardService.getActivity.mockResolvedValueOnce(
      activity,
    );

    await expect(
      controller.getActivity(user, query),
    ).resolves.toEqual(activity);

    expect(
      mockBlogownerDashboardService.getActivity,
    ).toHaveBeenCalledWith(99, 7);
  });

  it('should return featured posts with requested sort and limit', async () => {
    const user = {
      id: 99,
    } as any;

    const query = {
      sort: 'likes' as const,
      limit: 5,
    };

    const featured = {
      sort: 'likes',
      posts: [],
    };

    mockBlogownerDashboardService.getFeatured.mockResolvedValueOnce(
      featured,
    );

    await expect(
      controller.getFeatured(user, query),
    ).resolves.toEqual(featured);

    expect(
      mockBlogownerDashboardService.getFeatured,
    ).toHaveBeenCalledWith(
      99,
      'likes',
      5,
    );
  });

  it('should preserve the legacy dashboard endpoint', async () => {
    const user = {
      id: 99,
    } as any;

    const dashboard = {
      postCounts: {},
      totals: {},
      last7Days: [],
      featuredPosts: {
        byViews: [],
        byLikes: [],
      },
    };

    mockBlogownerDashboardService.getDashboard.mockResolvedValueOnce(
      dashboard,
    );

    await expect(
      controller.getDashboard(user),
    ).resolves.toEqual(dashboard);

    expect(
      mockBlogownerDashboardService.getDashboard,
    ).toHaveBeenCalledWith(99);
  });
});