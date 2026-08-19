import { Test, TestingModule } from '@nestjs/testing';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
  UserRole,
} from '@prisma/client';

import {
  JwtAuthGuard,
  RolesGuard,
  AuthenticatedUser,
} from '@app/core';
import type {
  PaginationParams,
} from '@app/core';

import { ModeratorReportsService } from '../services/moderator-reports.service';
import { ModeratorReportsController } from './moderator-reports.controller';

describe('ModeratorReportsController', () => {
  let controller: ModeratorReportsController;

  let moderatorReportsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    resolve: jest.Mock;
    reject: jest.Mock;
  };

  const moderator: AuthenticatedUser = {
    id: 2,
    role: UserRole.CONTENT_MODERATOR,
    email: 'mod@system.local',
  };

  const pagination: PaginationParams = {
    skip: 0,
    take: 10,
    page: 1,
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    moderatorReportsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      resolve: jest.fn(),
      reject: jest.fn(),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [ModeratorReportsController],
      providers: [
        {
          provide: ModeratorReportsService,
          useValue: moderatorReportsService,
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

    controller = module.get<ModeratorReportsController>(
      ModeratorReportsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return moderator reports', async () => {
    moderatorReportsService.findAll.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          targetType: ReportTargetType.POST,
          status: ReportStatus.PENDING,
        },
      ],
      meta: {
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      },
    });

    const query = {
      status: ReportStatus.PENDING,
      reason: ReportReason.SPAM,
    };

    const result = await controller.findAll(
      query,
      pagination,
    );

    expect(
      moderatorReportsService.findAll,
    ).toHaveBeenCalledWith(query, pagination);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe(
      ReportStatus.PENDING,
    );
  });

  it('should return report detail', async () => {
    moderatorReportsService.findOne.mockResolvedValueOnce({
      id: 1,
      targetType: ReportTargetType.POST,
      status: ReportStatus.PENDING,
    });

    const result = await controller.findOne(1);

    expect(
      moderatorReportsService.findOne,
    ).toHaveBeenCalledWith(1);

    expect(result.id).toBe(1);
  });

  it('should resolve a report', async () => {
    moderatorReportsService.resolve.mockResolvedValueOnce({
      id: 1,
      status: ReportStatus.RESOLVED,
      resolutionNote: 'Nội dung có vi phạm.',
    });

    const dto = {
      resolutionNote: 'Nội dung có vi phạm.',
    };

    const result = await controller.resolve(
      moderator,
      1,
      dto,
    );

    expect(
      moderatorReportsService.resolve,
    ).toHaveBeenCalledWith(2, 1, dto);

    expect(result.status).toBe(
      ReportStatus.RESOLVED,
    );
  });

  it('should reject a report', async () => {
    moderatorReportsService.reject.mockResolvedValueOnce({
      id: 2,
      status: ReportStatus.REJECTED,
      resolutionNote: 'Không phát hiện vi phạm.',
    });

    const dto = {
      resolutionNote: 'Không phát hiện vi phạm.',
    };

    const result = await controller.reject(
      moderator,
      2,
      dto,
    );

    expect(
      moderatorReportsService.reject,
    ).toHaveBeenCalledWith(2, 2, dto);

    expect(result.status).toBe(
      ReportStatus.REJECTED,
    );
  });
});