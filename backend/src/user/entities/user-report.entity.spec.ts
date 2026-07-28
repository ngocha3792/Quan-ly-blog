import { instanceToPlain } from 'class-transformer';
import {
  PostStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';
import { UserReportEntity } from './user-report.entity';

describe('UserReportEntity', () => {
  it('should hide reviewedById and resolutionNote and display reported post without sensitive fields', () => {
    const entity = new UserReportEntity({
      id: 1,
      reporterId: 10,
      targetType: ReportTargetType.POST,
      postId: 100,
      commentId: null,
      reason: ReportReason.SPAM,
      description: 'Spam post',
      status: ReportStatus.RESOLVED,
      reviewedById: 99,
      reviewedAt: new Date('2026-07-28T00:00:00.000Z'),
      resolutionNote: 'Internal moderator note: User warned',
      createdAt: new Date('2026-07-28T00:00:00.000Z'),
      updatedAt: new Date('2026-07-28T00:00:00.000Z'),
      post: {
        id: 100,
        title: 'Reported Post Title',
        thumbnailUrl: null,
        content: 'Bad spam content',
        status: PostStatus.PUBLISH,
        authorId: 5,
        publishedAt: new Date('2026-07-28T00:00:00.000Z'),
        createdAt: new Date('2026-07-28T00:00:00.000Z'),
        reviewedById: 50,
        rejectionReason: 'Not allowed',
        deletedAt: null,
        author: {
          id: 5,
          username: 'spammer',
          avatarUrl: 'https://example.com/avatar.png',
        },
      } as any,
    });

    const result = instanceToPlain(entity);

    // Kiểm tra ẩn các trường nhạy cảm của Report
    expect(result).not.toHaveProperty('reviewedById');
    expect(result).not.toHaveProperty('resolutionNote');

    // Kiểm tra giữ lại các thông tin cơ bản của Report
    expect(result.id).toBe(1);
    expect(result.reason).toBe(ReportReason.SPAM);
    expect(result.status).toBe(ReportStatus.RESOLVED);

    // Kiểm tra hiển thị post bị report
    expect(result.post).toBeDefined();
    expect(result.post.id).toBe(100);
    expect(result.post.title).toBe('Reported Post Title');
    expect(result.post.author.username).toBe('spammer');

    // Kiểm tra ẩn các trường kiểm duyệt nội bộ và xóa mềm của post bị report
    expect(result.post).not.toHaveProperty('reviewedById');
    expect(result.post).not.toHaveProperty('rejectionReason');
    expect(result.post).not.toHaveProperty('deletedAt');
  });

  it('should display reported comment without sensitive fields', () => {
    const entity = new UserReportEntity({
      id: 2,
      reporterId: 10,
      targetType: ReportTargetType.COMMENT,
      postId: null,
      commentId: 500,
      reason: ReportReason.HARASSMENT,
      description: 'Harassing comment',
      status: ReportStatus.PENDING,
      reviewedById: null,
      reviewedAt: null,
      resolutionNote: null,
      createdAt: new Date('2026-07-28T00:00:00.000Z'),
      updatedAt: new Date('2026-07-28T00:00:00.000Z'),
      comment: {
        id: 500,
        postId: 100,
        userId: 8,
        parentId: null,
        content: 'Rude comment',
        createdAt: new Date('2026-07-28T00:00:00.000Z'),
        deletedAt: null,
        user: {
          id: 8,
          username: 'baduser',
          avatarUrl: null,
        },
      } as any,
    });

    const result = instanceToPlain(entity);

    expect(result.comment).toBeDefined();
    expect(result.comment.id).toBe(500);
    expect(result.comment.content).toBe('Rude comment');
    expect(result.comment.user.username).toBe('baduser');
    expect(result.comment).not.toHaveProperty('deletedAt');
  });
});
