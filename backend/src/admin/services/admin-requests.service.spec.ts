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
    blogOwnerRequest: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    userSession: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockBlogOwnerRequestsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockPrismaService.$transaction.mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(mockPrismaService);
      }
      return Promise.all(cb);
    });

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
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 10,
          totalPages: 0,
          currentPage: 1,
        },
      };
      mockBlogOwnerRequestsService.findAll.mockResolvedValueOnce(mockPaginated);

      const result = await service.findAllRequests(
        {},
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      );

      expect(mockBlogOwnerRequestsService.findAll).toHaveBeenCalledWith(
        {},
        { skip: 0, take: 10, page: 1 },
      );
      expect(result).toBe(mockPaginated);
    });
  });

  describe('reviewRequest', () => {
    it('should update request status, promote user role to BLOG_OWNER and revoke active sessions in transaction when APPROVED', async () => {
      const initialRequest = new BlogOwnerRequestEntity({
        id: 1,
        userId: 10,
        status: BlogOwnerRequestStatus.PENDING,
        reason: 'Want to blog',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updatedRequestData = {
        ...initialRequest,
        status: BlogOwnerRequestStatus.APPROVED,
        reviewedById: 99,
        reviewedAt: new Date(),
      };

      mockBlogOwnerRequestsService.findOne.mockResolvedValueOnce(
        initialRequest,
      );
      mockPrismaService.blogOwnerRequest.updateMany.mockResolvedValueOnce({
        count: 1,
      });
      mockPrismaService.user.update.mockResolvedValueOnce({});
      mockPrismaService.userSession.updateMany.mockResolvedValueOnce({
        count: 1,
      });
      mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce(
        updatedRequestData,
      );

      const result = await service.reviewRequest(1, 99, {
        status: BlogOwnerRequestStatus.APPROVED,
      });

      expect(
        mockPrismaService.blogOwnerRequest.updateMany,
      ).toHaveBeenCalledWith({
        where: { id: 1, status: BlogOwnerRequestStatus.PENDING },
        data: {
          status: BlogOwnerRequestStatus.APPROVED,
          rejectionReason: null,
          reviewedById: 99,
          reviewedAt: expect.any(Date),
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { role: UserRole.BLOG_OWNER },
      });
      expect(mockPrismaService.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 10, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
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

      const updatedRequestData = {
        ...initialRequest,
        status: BlogOwnerRequestStatus.REJECTED,
        rejectionReason: 'Invalid topic',
        reviewedById: 99,
        reviewedAt: new Date(),
      };

      mockBlogOwnerRequestsService.findOne.mockResolvedValueOnce(
        initialRequest,
      );
      mockPrismaService.blogOwnerRequest.updateMany.mockResolvedValueOnce({
        count: 1,
      });
      mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce(
        updatedRequestData,
      );

      const result = await service.reviewRequest(1, 99, {
        status: BlogOwnerRequestStatus.REJECTED,
        rejectionReason: 'Invalid topic',
      });

      expect(
        mockPrismaService.blogOwnerRequest.updateMany,
      ).toHaveBeenCalledWith({
        where: { id: 1, status: BlogOwnerRequestStatus.PENDING },
        data: {
          status: BlogOwnerRequestStatus.REJECTED,
          rejectionReason: 'Invalid topic',
          reviewedById: 99,
          reviewedAt: expect.any(Date),
        },
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(result.status).toBe(BlogOwnerRequestStatus.REJECTED);
    });

    it('should throw BadRequestException if updateMany returns count 0 (concurrent review)', async () => {
      const initialRequest = new BlogOwnerRequestEntity({
        id: 1,
        userId: 10,
        status: BlogOwnerRequestStatus.PENDING,
        reason: 'Want to blog',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockBlogOwnerRequestsService.findOne.mockResolvedValueOnce(
        initialRequest,
      );
      mockPrismaService.blogOwnerRequest.updateMany.mockResolvedValueOnce({
        count: 0,
      });

      await expect(
        service.reviewRequest(1, 99, {
          status: BlogOwnerRequestStatus.APPROVED,
        }),
      ).rejects.toThrow(BadRequestException);
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

      mockBlogOwnerRequestsService.findOne.mockResolvedValueOnce(
        processedRequest,
      );

      await expect(
        service.reviewRequest(1, 99, {
          status: BlogOwnerRequestStatus.APPROVED,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
