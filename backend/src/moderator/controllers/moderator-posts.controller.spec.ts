import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus, UserRole } from '@prisma/client';

import { JwtAuthGuard, RolesGuard, AuthenticatedUser } from '@app/core';
import type { PaginationParams } from '@app/core';

import { ModeratorPostsService } from '../services/moderator-posts.service';
import { ModeratorPostsController } from './moderator-posts.controller';

describe('ModeratorPostsController', () => {
  let controller: ModeratorPostsController;

  let moderatorPostsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    approve: jest.Mock;
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

    moderatorPostsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [ModeratorPostsController],
      providers: [
        {
          provide: ModeratorPostsService,
          useValue: moderatorPostsService,
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

    controller = module.get<ModeratorPostsController>(ModeratorPostsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return moderator posts', async () => {
    moderatorPostsService.findAll.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          status: PostStatus.PENDING_REVIEW,
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
      status: PostStatus.PENDING_REVIEW,
    };

    const result = await controller.findAll(query, pagination);

    expect(moderatorPostsService.findAll).toHaveBeenCalledWith(
      query,
      pagination,
    );

    expect(result.items).toHaveLength(1);
  });

  it('should return one moderator post', async () => {
    moderatorPostsService.findOne.mockResolvedValueOnce({
      id: 1,
      status: PostStatus.PENDING_REVIEW,
    });

    const result = await controller.findOne(1);

    expect(moderatorPostsService.findOne).toHaveBeenCalledWith(1);

    expect(result.id).toBe(1);
  });

  it('should approve a pending post', async () => {
    moderatorPostsService.approve.mockResolvedValueOnce({
      id: 1,
      status: PostStatus.PUBLISH,
    });

    const result = await controller.approve(moderator, 1);

    expect(moderatorPostsService.approve).toHaveBeenCalledWith(2, 1);

    expect(result.status).toBe(PostStatus.PUBLISH);
  });

  it('should reject a pending post', async () => {
    moderatorPostsService.reject.mockResolvedValueOnce({
      id: 1,
      status: PostStatus.REJECT,
      rejectionReason: 'Bài viết cần bổ sung nguồn tham khảo.',
    });

    const dto = {
      rejectionReason: 'Bài viết cần bổ sung nguồn tham khảo.',
    };

    const result = await controller.reject(moderator, 1, dto);

    expect(moderatorPostsService.reject).toHaveBeenCalledWith(2, 1, dto);

    expect(result.status).toBe(PostStatus.REJECT);
    expect(result.rejectionReason).toBe(dto.rejectionReason);
  });
});
