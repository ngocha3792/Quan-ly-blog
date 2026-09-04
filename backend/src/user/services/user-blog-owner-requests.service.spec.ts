import { Test, TestingModule } from '@nestjs/testing';
import { BlogOwnerRequestStatus, UserRole } from '@prisma/client';

import {
  BlogOwnerRequestNotFoundException,
  BlogOwnerRequestsService,
  ExistActionNotAllowedException,
  PrismaService,
  UserNotFoundException,
} from '@app/core';

import { UserBlogOwnerRequestsService } from './user-blog-owner-requests.service';

describe('UserBlogOwnerRequestsService', () => {
  let service: UserBlogOwnerRequestsService;
  let blogOwnerRequestsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    blogOwnerRequestsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserBlogOwnerRequestsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: BlogOwnerRequestsService,
          useValue: blogOwnerRequestsService,
        },
      ],
    }).compile();

    service = module.get<UserBlogOwnerRequestsService>(
      UserBlogOwnerRequestsService,
    );
  });

  describe('create', () => {
    it('should create blog owner request successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        role: UserRole.NORMAL,
      });
      const mockReq = {
        id: 10,
        userId: 1,
        reason: 'Xin viết bài',
        status: BlogOwnerRequestStatus.PENDING,
      };
      blogOwnerRequestsService.create.mockResolvedValue(mockReq);

      const result = await service.create(1, { reason: 'Xin viết bài' });

      expect(result.id).toBe(10);
      expect(result.reason).toBe('Xin viết bài');
      expect(blogOwnerRequestsService.create).toHaveBeenCalledWith(1, {
        reason: 'Xin viết bài',
      });
    });

    it('should throw UserNotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(1, { reason: 'Xin viết bài' }),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('should throw ExistActionNotAllowedException if user is already BLOG_OWNER', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        role: UserRole.BLOG_OWNER,
      });

      await expect(
        service.create(1, { reason: 'Xin viết bài' }),
      ).rejects.toThrow(ExistActionNotAllowedException);
    });
  });

  describe('findAll', () => {
    it('should return paginated user requests with overridden userId', async () => {
      const mockResult = {
        items: [
          {
            id: 1,
            userId: 5,
            reason: 'Lý do 1',
            status: BlogOwnerRequestStatus.PENDING,
          },
        ],
        meta: {
          totalItems: 1,
          currentPage: 1,
          itemsPerPage: 10,
          totalPages: 1,
        },
      };
      blogOwnerRequestsService.findAll.mockResolvedValue(mockResult as any);

      const res = await service.findAll(
        5,
        { status: BlogOwnerRequestStatus.PENDING },
        { page: 1, take: 10, skip: 0 },
      );

      expect(blogOwnerRequestsService.findAll).toHaveBeenCalledWith(
        { status: BlogOwnerRequestStatus.PENDING, userId: 5 },
        { page: 1, take: 10, skip: 0 },
      );
      expect(res.meta.totalItems).toBe(1);
      expect(res.items[0].id).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return request if user owns it', async () => {
      blogOwnerRequestsService.findOne.mockResolvedValue({
        id: 100,
        userId: 2,
        reason: 'Test',
      });

      const res = await service.findOne(2, 100);

      expect(res.id).toBe(100);
    });

    it('should throw BlogOwnerRequestNotFoundException if request belongs to another user', async () => {
      blogOwnerRequestsService.findOne.mockResolvedValue({
        id: 100,
        userId: 99,
        reason: 'Test',
      });

      await expect(service.findOne(2, 100)).rejects.toThrow(
        BlogOwnerRequestNotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete request if PENDING and owned by user', async () => {
      blogOwnerRequestsService.findOne.mockResolvedValue({
        id: 50,
        userId: 3,
        status: BlogOwnerRequestStatus.PENDING,
      });
      blogOwnerRequestsService.remove.mockResolvedValue({
        id: 50,
        userId: 3,
        status: BlogOwnerRequestStatus.PENDING,
      });

      const res = await service.remove(3, 50);

      expect(res.id).toBe(50);
      expect(blogOwnerRequestsService.remove).toHaveBeenCalledWith(50);
    });

    it('should throw ExistActionNotAllowedException if request is not PENDING', async () => {
      blogOwnerRequestsService.findOne.mockResolvedValue({
        id: 50,
        userId: 3,
        status: BlogOwnerRequestStatus.APPROVED,
      });

      await expect(service.remove(3, 50)).rejects.toThrow(
        ExistActionNotAllowedException,
      );
    });
  });
});
