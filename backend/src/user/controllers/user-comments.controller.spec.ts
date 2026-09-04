import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard, RolesGuard, AuthenticatedUser } from '@app/core';

import { UserCommentsController } from './user-comments.controller';
import { UserCommentsService } from '../services/user-comments.service';

describe('UserCommentsController', () => {
  let controller: UserCommentsController;

  let userCommentsService: {
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const currentUser: AuthenticatedUser = {
    id: 4,
    role: UserRole.NORMAL,
    email: 'user@system.local',
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    userCommentsService = {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [UserCommentsController],
      providers: [
        {
          provide: UserCommentsService,
          useValue: userCommentsService,
        },
      ],
    });

    /**
     * Unit test controller không kiểm tra JWT/Role.
     * Hai guard được mock để luôn cho phép request đi qua.
     */
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

    controller = module.get<UserCommentsController>(UserCommentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a comment using postId from URL', async () => {
    userCommentsService.create.mockResolvedValueOnce({
      id: 2,
      postId: 1,
      userId: 4,
      parentId: null,
      content: 'Bình luận mới',
    });

    const result = await controller.create(currentUser, 1, {
      content: 'Bình luận mới',
    });

    expect(userCommentsService.create).toHaveBeenCalledWith(4, 1, {
      content: 'Bình luận mới',
    });

    expect(result.id).toBe(2);
  });

  it('should create a reply with parentId', async () => {
    userCommentsService.create.mockResolvedValueOnce({
      id: 3,
      postId: 1,
      userId: 4,
      parentId: 1,
      content: 'Phản hồi mới',
    });

    const result = await controller.create(currentUser, 1, {
      content: 'Phản hồi mới',
      parentId: 1,
    });

    expect(userCommentsService.create).toHaveBeenCalledWith(4, 1, {
      content: 'Phản hồi mới',
      parentId: 1,
    });

    expect(result.parentId).toBe(1);
  });

  it('should update the current user comment', async () => {
    userCommentsService.update.mockResolvedValueOnce({
      id: 2,
      content: 'Nội dung đã sửa',
    });

    const result = await controller.update(currentUser, 2, {
      content: 'Nội dung đã sửa',
    });

    expect(userCommentsService.update).toHaveBeenCalledWith(2, 4, {
      content: 'Nội dung đã sửa',
    });

    expect(result.content).toBe('Nội dung đã sửa');
  });

  it('should remove the current user comment', async () => {
    userCommentsService.remove.mockResolvedValueOnce({
      id: 2,
      deletedAt: new Date(),
    });

    const result = await controller.remove(currentUser, 2);

    expect(userCommentsService.remove).toHaveBeenCalledWith(2, 4);
    expect(result.id).toBe(2);
  });
});
