import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard, RolesGuard, AuthenticatedUser } from '@app/core';

import { UserBlogOwnerRequestsService } from '../services/user-blog-owner-requests.service';
import { UserBlogOwnerRequestsController } from './user-blog-owner-requests.controller';

describe('UserBlogOwnerRequestsController', () => {
  let controller: UserBlogOwnerRequestsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };

  const currentUser: AuthenticatedUser = {
    id: 1,
    role: UserRole.NORMAL,
    email: 'test@example.com',
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [UserBlogOwnerRequestsController],
      providers: [
        {
          provide: UserBlogOwnerRequestsService,
          useValue: service,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true });

    const moduleRef = await moduleBuilder.compile();
    controller = moduleRef.get<UserBlogOwnerRequestsController>(
      UserBlogOwnerRequestsController,
    );
  });

  it('should call service.create on create', async () => {
    const dto = { reason: 'Xin viết bài' };
    service.create.mockResolvedValue({ id: 10, ...dto });

    const res = await controller.create(currentUser, dto);
    expect(res).toEqual({ id: 10, ...dto });
    expect(service.create).toHaveBeenCalledWith(1, dto);
  });

  it('should call service.findAll on findAll', async () => {
    service.findAll.mockResolvedValue({ items: [], meta: {} as any });

    const res = await controller.findAll(
      currentUser,
      {},
      { page: 1, take: 10, skip: 0 },
    );
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      {},
      { page: 1, take: 10, skip: 0 },
    );
    expect(res).toEqual({ items: [], meta: {} as any });
  });

  it('should call service.findOne on findOne', async () => {
    service.findOne.mockResolvedValue({ id: 5 });

    const res = await controller.findOne(currentUser, 5);
    expect(res).toEqual({ id: 5 });
    expect(service.findOne).toHaveBeenCalledWith(1, 5);
  });

  it('should call service.remove on remove', async () => {
    service.remove.mockResolvedValue({ id: 5 });

    const res = await controller.remove(currentUser, 5);
    expect(res).toEqual({ id: 5 });
    expect(service.remove).toHaveBeenCalledWith(1, 5);
  });
});
