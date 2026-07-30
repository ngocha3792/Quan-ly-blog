import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BlogOwnerRequestStatus, UserRole } from '@prisma/client';
import {
  PrismaService,
  BlogOwnerRequestsService,
  BlogOwnerRequestEntity,
} from '@app/core';
import { AdminRequestsService } from './admin-requests.service';

describe('AdminRequestsService', () => {
  let service: AdminRequestsService;

  const mockPrismaService = {
    user: {
      update: jest.fn(),
    },
  };

  const mockBlogOwnerRequestsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRequestsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: BlogOwnerRequestsService,
          useValue: mockBlogOwnerRequestsService,
        },
      ],
    }).compile();

    service = module.get<AdminRequestsService>(AdminRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllRequests', () => {
    it('should delegate to blogOwnerRequestsService.findAll', async () => {
      const mockPaginated = {
        items: [],
        meta: { totalItems: 0, itemCount: 0, itemsPerPage: 10, totalPages: 0, currentPage: 1 },
      };
      mockBlogOwnerRequestsService.findAll.mockResolvedValueOnce(mockPaginated);

      const result = await service.findAllRequests({} as any, { skip: 0, take: 10, page: 1 });

      expect(mockBlogOwnerRequestsService.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10, page: 1 });
      expect(result).toBe(mockPaginated);
    });
  });

  describe('reviewRequest', () => {
    it('should update request status and promote user role to BLOG_OWNER when APPROVED', async () => {
      const initialRequest = new BlogOwnerRequestEntity({
        id: 1,
        userId: 10,
        status: BlogOwnerRequestStatus.PENDING,
        reason: 'Want to blog',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updatedRequest = new BlogOwnerRequestEntity({
        ...initialRequest,
        status: BlogOwnerRequestStatus.APPROVED,
        reviewedById: 99,
        reviewedAt: new Date(),
      });

      mockBlogOwnerRequestsService.findOne.mockResolvedValueOnce(initialRequest);
      mockBlogOwnerRequestsService.update.mockResolvedValueOnce(updatedRequest);
      mockPrismaService.user.update.mockResolvedValueOnce({});

      const result = await service.reviewRequest(1, 99, {
        status: BlogOwnerRequestStatus.APPROVED,
      });

      expect(mockBlogOwnerRequestsService.update).toHaveBeenCalledWith(1, 99, {
        status: BlogOwnerRequestStatus.APPROVED,
        rejectionReason: undefined,
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { role: UserRole.BLOG_OWNER },
      });
      expect(result.status).toBe(BlogOwnerRequestStatus.APPROVED);
    });

    it('should update request status and NOT promote user role when REJECTED', async () => {
      const initialRequest = new BlogOwnerRequestEntity({
        id: 1,
        userId: 10,
        status: BlogOwnerRequestStatus.PENDING,
        reason: 'Want to blog',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updatedRequest = new BlogOwnerRequestEntity({
        ...initialRequest,
        status: BlogOwnerRequestStatus.REJECTED,
        rejectionReason: 'Invalid topic',
        reviewedById: 99,
        reviewedAt: new Date(),
      });

      mockBlogOwnerRequestsService.findOne.mockResolvedValueOnce(initialRequest);
      mockBlogOwnerRequestsService.update.mockResolvedValueOnce(updatedRequest);

      const result = await service.reviewRequest(1, 99, {
        status: BlogOwnerRequestStatus.REJECTED,
        rejectionReason: 'Invalid topic',
      });

      expect(mockBlogOwnerRequestsService.update).toHaveBeenCalledWith(1, 99, {
        status: BlogOwnerRequestStatus.REJECTED,
        rejectionReason: 'Invalid topic',
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(result.status).toBe(BlogOwnerRequestStatus.REJECTED);
    });

    it('should throw BadRequestException if request has already been processed', async () => {
      const processedRequest = new BlogOwnerRequestEntity({
        id: 1,
        userId: 10,
        status: BlogOwnerRequestStatus.APPROVED,
        reason: 'Want to blog',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockBlogOwnerRequestsService.findOne.mockResolvedValueOnce(processedRequest);

      await expect(
        service.reviewRequest(1, 99, {
          status: BlogOwnerRequestStatus.APPROVED,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
