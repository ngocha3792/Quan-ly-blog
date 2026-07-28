import 'reflect-metadata';

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PostStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import { PrismaService, ReportsService } from '@app/core';

import { ModeratorReportsService } from './moderator-reports.service';

describe('ModeratorReportsService', () => {
  let service: ModeratorReportsService;

  const date = new Date(
    '2026-07-28T00:00:00.000Z',
  );

  const basePostReport = {
    id: 1,
    reporterId: 4,
    targetType: ReportTargetType.POST,
    postId: 6,
    commentId: null,
    reason: ReportReason.MISINFORMATION,
    description: 'Thông tin cần được kiểm tra.',
    status: ReportStatus.PENDING,
    reviewedById: null,
    reviewedAt: null,
    resolutionNote: null,
    createdAt: date,
    updatedAt: date,

    reporter: {
      id: 4,
      username: 'normal_user',
      avatarUrl: null,
    },

    reviewedBy: null,

    post: {
      id: 6,
      title: 'Bài viết bị báo cáo',
      thumbnailUrl: null,
      content: 'Nội dung bài viết.',
      status: PostStatus.PUBLISH,
      authorId: 3,
      publishedAt: date,
      createdAt: date,
      author: {
        id: 3,
        username: 'pro_blogger',
        avatarUrl: null,
      },
    },

    comment: null,
  };

  const baseCommentReport = {
    id: 2,
    reporterId: 3,
    targetType: ReportTargetType.COMMENT,
    postId: null,
    commentId: 1,
    reason: ReportReason.HARASSMENT,
    description: 'Bình luận công kích.',
    status: ReportStatus.PENDING,
    reviewedById: null,
    reviewedAt: null,
    resolutionNote: null,
    createdAt: date,
    updatedAt: date,

    reporter: {
      id: 3,
      username: 'pro_blogger',
      avatarUrl: null,
    },

    reviewedBy: null,
    post: null,

    comment: {
      id: 1,
      postId: 6,
      userId: 4,
      parentId: null,
      content: 'Bình luận bị report.',
      createdAt: date,

      user: {
        id: 4,
        username: 'normal_user',
        avatarUrl: null,
      },

      post: {
        id: 6,
        title: 'Bài chứa bình luận',
        thumbnailUrl: null,
        content: 'Nội dung bài.',
        status: PostStatus.PUBLISH,
        authorId: 3,
        publishedAt: date,
        createdAt: date,

        author: {
          id: 3,
          username: 'pro_blogger',
          avatarUrl: null,
        },
      },

      parent: null,
    },
  };

  const mockPrismaService = {
    report: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },

    post: {
      updateMany: jest.fn(),
    },

    comment: {
      updateMany: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockPrismaService.$transaction.mockImplementation(
      async (callback) =>
        callback(mockPrismaService),
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          ModeratorReportsService,
          ReportsService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
        ],
      }).compile();

    service = module.get<ModeratorReportsService>(
      ModeratorReportsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return pending reports by default', async () => {
      mockPrismaService.report.findMany.mockResolvedValueOnce([
        basePostReport,
      ]);

      mockPrismaService.report.count.mockResolvedValueOnce(1);

      const result = await service.findAll(
        {},
        {
          skip: 0,
          take: 10,
          page: 1,
        },
      );

      expect(
        mockPrismaService.report.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: ReportStatus.PENDING,
          },
          skip: 0,
          take: 10,
          orderBy: {
            createdAt: 'asc',
          },
          include: expect.any(Object),
        }),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(1);

      expect(result.meta).toEqual({
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      });
    });
  });

  describe('findOne', () => {
    it('should throw when report does not exist', async () => {
      mockPrismaService.report.findUnique.mockResolvedValueOnce(
        null,
      );

      await expect(service.findOne(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return report detail', async () => {
      mockPrismaService.report.findUnique.mockResolvedValueOnce(
        basePostReport,
      );

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.targetType).toBe(
        ReportTargetType.POST,
      );
    });
  });

  describe('resolve', () => {
    it('should resolve post report and hide post', async () => {
      mockPrismaService.report.findUnique
        .mockResolvedValueOnce({
          id: 1,
          status: ReportStatus.PENDING,
          targetType: ReportTargetType.POST,
          postId: 6,
          commentId: null,
        })
        .mockResolvedValueOnce({
          ...basePostReport,
          status: ReportStatus.RESOLVED,
          reviewedById: 2,
          reviewedAt: date,
          resolutionNote: 'Bài viết có nội dung vi phạm.',
          reviewedBy: {
            id: 2,
            username: 'content_moderator',
            avatarUrl: null,
          },
        });

      mockPrismaService.report.updateMany
        .mockResolvedValueOnce({
          count: 1,
        })
        .mockResolvedValueOnce({
          count: 2,
        });

      mockPrismaService.post.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.resolve(2, 1, {
        resolutionNote: 'Bài viết có nội dung vi phạm.',
      });

      expect(
        mockPrismaService.post.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 6,
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      });

      expect(
        mockPrismaService.report.updateMany,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          targetType: ReportTargetType.POST,
          postId: 6,
          status: ReportStatus.PENDING,
        },
        data: {
          status: ReportStatus.RESOLVED,
          reviewedById: 2,
          reviewedAt: expect.any(Date),
          resolutionNote:
            'Bài viết có nội dung vi phạm.',
        },
      });

      expect(result.status).toBe(
        ReportStatus.RESOLVED,
      );
    });

    it('should resolve comment report and hide comment', async () => {
      mockPrismaService.report.findUnique
        .mockResolvedValueOnce({
          id: 2,
          status: ReportStatus.PENDING,
          targetType: ReportTargetType.COMMENT,
          postId: null,
          commentId: 1,
        })
        .mockResolvedValueOnce({
          ...baseCommentReport,
          status: ReportStatus.RESOLVED,
          reviewedById: 2,
          reviewedAt: date,
          resolutionNote: 'Bình luận có nội dung vi phạm.',
          reviewedBy: {
            id: 2,
            username: 'content_moderator',
            avatarUrl: null,
          },
        });

      mockPrismaService.report.updateMany
        .mockResolvedValueOnce({
          count: 1,
        })
        .mockResolvedValueOnce({
          count: 1,
        });

      mockPrismaService.comment.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.resolve(2, 2, {
        resolutionNote:
          'Bình luận có nội dung vi phạm.',
      });

      expect(
        mockPrismaService.comment.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 1,
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      });

      expect(
        mockPrismaService.report.updateMany,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          targetType: ReportTargetType.COMMENT,
          commentId: 1,
          status: ReportStatus.PENDING,
        },
        data: {
          status: ReportStatus.RESOLVED,
          reviewedById: 2,
          reviewedAt: expect.any(Date),
          resolutionNote:
            'Bình luận có nội dung vi phạm.',
        },
      });

      expect(result.status).toBe(
        ReportStatus.RESOLVED,
      );
    });

    it('should reject resolving a non-pending report', async () => {
      mockPrismaService.report.findUnique.mockResolvedValueOnce({
        id: 1,
        status: ReportStatus.RESOLVED,
        targetType: ReportTargetType.POST,
        postId: 6,
        commentId: null,
      });

      await expect(
        service.resolve(2, 1, {
          resolutionNote: 'Đã xử lý.',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(
        mockPrismaService.post.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('should detect concurrent resolution', async () => {
      mockPrismaService.report.findUnique.mockResolvedValueOnce({
        id: 1,
        status: ReportStatus.PENDING,
        targetType: ReportTargetType.POST,
        postId: 6,
        commentId: null,
      });

      mockPrismaService.report.updateMany.mockResolvedValueOnce({
        count: 0,
      });

      await expect(
        service.resolve(2, 1, {
          resolutionNote: 'Nội dung vi phạm.',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reject', () => {
    it('should reject report without hiding target', async () => {
      mockPrismaService.report.findUnique
        .mockResolvedValueOnce({
          id: 1,
          status: ReportStatus.PENDING,
        })
        .mockResolvedValueOnce({
          ...basePostReport,
          status: ReportStatus.REJECTED,
          reviewedById: 2,
          reviewedAt: date,
          resolutionNote: 'Không phát hiện vi phạm.',
          reviewedBy: {
            id: 2,
            username: 'content_moderator',
            avatarUrl: null,
          },
        });

      mockPrismaService.report.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.reject(2, 1, {
        resolutionNote: 'Không phát hiện vi phạm.',
      });

      expect(
        mockPrismaService.report.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 1,
          status: ReportStatus.PENDING,
        },
        data: {
          status: ReportStatus.REJECTED,
          reviewedById: 2,
          reviewedAt: expect.any(Date),
          resolutionNote: 'Không phát hiện vi phạm.',
        },
      });

      expect(
        mockPrismaService.post.updateMany,
      ).not.toHaveBeenCalled();

      expect(
        mockPrismaService.comment.updateMany,
      ).not.toHaveBeenCalled();

      expect(result.status).toBe(
        ReportStatus.REJECTED,
      );
    });

    it('should throw when rejecting missing report', async () => {
      mockPrismaService.report.findUnique.mockResolvedValueOnce(
        null,
      );

      await expect(
        service.reject(2, 999, {
          resolutionNote: 'Không hợp lệ.',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});