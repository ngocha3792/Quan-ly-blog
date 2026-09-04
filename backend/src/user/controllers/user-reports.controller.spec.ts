import { Test, TestingModule } from '@nestjs/testing';
import { ReportReason, UserRole } from '@prisma/client';

import { JwtAuthGuard, RolesGuard, AuthenticatedUser } from '@app/core';

import { UserReportsService } from '../services/user-reports.service';
import { UserReportsController } from './user-reports.controller';

describe('UserReportsController', () => {
  let controller: UserReportsController;

  let userReportsService: {
    reportPost: jest.Mock;
    reportComment: jest.Mock;
  };

  const currentUser: AuthenticatedUser = {
    id: 4,
    role: UserRole.NORMAL,
    email: 'user@system.local',
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    userReportsService = {
      reportPost: jest.fn(),
      reportComment: jest.fn(),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [UserReportsController],
      providers: [
        {
          provide: UserReportsService,
          useValue: userReportsService,
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

    controller = module.get<UserReportsController>(UserReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should report a post', async () => {
    userReportsService.reportPost.mockResolvedValueOnce({
      id: 10,
      postId: 1,
    });

    const result = await controller.reportPost(currentUser, 1, {
      reason: ReportReason.SPAM,
      description: 'Bài viết có dấu hiệu spam.',
    });

    expect(userReportsService.reportPost).toHaveBeenCalledWith(4, 1, {
      reason: ReportReason.SPAM,
      description: 'Bài viết có dấu hiệu spam.',
    });

    expect(result.id).toBe(10);
  });

  it('should report a comment', async () => {
    userReportsService.reportComment.mockResolvedValueOnce({
      id: 11,
      commentId: 2,
    });

    const result = await controller.reportComment(currentUser, 2, {
      reason: ReportReason.HARASSMENT,
      description: 'Bình luận công kích.',
    });

    expect(userReportsService.reportComment).toHaveBeenCalledWith(4, 2, {
      reason: ReportReason.HARASSMENT,
      description: 'Bình luận công kích.',
    });

    expect(result.id).toBe(11);
  });
});
