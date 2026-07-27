import { Test, TestingModule } from '@nestjs/testing';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import {
  CommentNotFoundException,
  ExistActionNotAllowedException,
  PostNotFoundException,
  PrismaService,
  ReportsService,
  SelfActionNotAllowedException,
} from '@app/core';

import { UserReportsService } from './user-reports.service';

describe('UserReportsService', () => {
  let service: UserReportsService;

  let reportsService: {
    create: jest.Mock;
  };

  const mockPrismaService = {
    post: {
      findFirst: jest.fn(),
    },

    comment: {
      findFirst: jest.fn(),
    },

    report: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    reportsService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ReportsService,
          useValue: reportsService,
        },
      ],
    }).compile();

    service = module.get<UserReportsService>(
      UserReportsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportPost', () => {
    it('should reject a post that is not public', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce(
        null,
      );

      await expect(
        service.reportPost(4, 999, {
          reason: ReportReason.SPAM,
        }),
      ).rejects.toThrow(PostNotFoundException);

      expect(reportsService.create).not.toHaveBeenCalled();
    });

    it('should reject reporting own post', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
        authorId: 3,
      });

      await expect(
        service.reportPost(3, 1, {
          reason: ReportReason.SPAM,
        }),
      ).rejects.toThrow(SelfActionNotAllowedException);

      expect(reportsService.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate pending post report', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
        authorId: 3,
      });

      mockPrismaService.report.findFirst.mockResolvedValueOnce({
        id: 10,
      });

      await expect(
        service.reportPost(4, 1, {
          reason: ReportReason.SPAM,
        }),
      ).rejects.toThrow(ExistActionNotAllowedException);

      expect(reportsService.create).not.toHaveBeenCalled();
    });

    it('should create a post report', async () => {
      mockPrismaService.post.findFirst.mockResolvedValueOnce({
        id: 1,
        authorId: 3,
      });

      mockPrismaService.report.findFirst.mockResolvedValueOnce(
        null,
      );

      reportsService.create.mockResolvedValueOnce({
        id: 20,
        reporterId: 4,
        targetType: ReportTargetType.POST,
        postId: 1,
        reason: ReportReason.MISINFORMATION,
        status: ReportStatus.PENDING,
      });

      const result = await service.reportPost(4, 1, {
        reason: ReportReason.MISINFORMATION,
        description: 'Thông tin chưa chính xác.',
      });

      expect(reportsService.create).toHaveBeenCalledWith(4, {
        targetType: ReportTargetType.POST,
        postId: 1,
        reason: ReportReason.MISINFORMATION,
        description: 'Thông tin chưa chính xác.',
      });

      expect(result.id).toBe(20);
    });
  });

  describe('reportComment', () => {
    it('should reject a comment that is not public', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce(
        null,
      );

      await expect(
        service.reportComment(3, 999, {
          reason: ReportReason.HARASSMENT,
        }),
      ).rejects.toThrow(CommentNotFoundException);

      expect(reportsService.create).not.toHaveBeenCalled();
    });

    it('should reject reporting own comment', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 1,
        userId: 4,
        postId: 1,
      });

      await expect(
        service.reportComment(4, 1, {
          reason: ReportReason.HARASSMENT,
        }),
      ).rejects.toThrow(SelfActionNotAllowedException);

      expect(reportsService.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate pending comment report', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 1,
        userId: 4,
        postId: 1,
      });

      mockPrismaService.report.findFirst.mockResolvedValueOnce({
        id: 11,
      });

      await expect(
        service.reportComment(3, 1, {
          reason: ReportReason.HARASSMENT,
        }),
      ).rejects.toThrow(ExistActionNotAllowedException);

      expect(reportsService.create).not.toHaveBeenCalled();
    });

    it('should create a comment report', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValueOnce({
        id: 1,
        userId: 4,
        postId: 1,
      });

      mockPrismaService.report.findFirst.mockResolvedValueOnce(
        null,
      );

      reportsService.create.mockResolvedValueOnce({
        id: 21,
        reporterId: 3,
        targetType: ReportTargetType.COMMENT,
        commentId: 1,
        reason: ReportReason.HARASSMENT,
        status: ReportStatus.PENDING,
      });

      const result = await service.reportComment(3, 1, {
        reason: ReportReason.HARASSMENT,
        description: 'Bình luận công kích người khác.',
      });

      expect(reportsService.create).toHaveBeenCalledWith(3, {
        targetType: ReportTargetType.COMMENT,
        commentId: 1,
        reason: ReportReason.HARASSMENT,
        description: 'Bình luận công kích người khác.',
      });

      expect(result.id).toBe(21);
    });
  });
});