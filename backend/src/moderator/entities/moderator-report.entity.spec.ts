import 'reflect-metadata';
import { instanceToPlain } from 'class-transformer';
import {
  PostStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import { ModeratorReportEntity } from './moderator-report.entity';

describe('ModeratorReportEntity', () => {
  it('should expose report context and hide reviewedById', () => {
    const date = new Date('2026-07-28T00:00:00.000Z');

    const entity = new ModeratorReportEntity({
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
    });

    const result = instanceToPlain(entity);

    expect(result).not.toHaveProperty('reviewedById');

    expect(result.reporter).toEqual({
      id: 4,
      username: 'normal_user',
      avatarUrl: null,
    });

    expect(result.post.id).toBe(6);
    expect(result.post.title).toBe('Bài viết bị báo cáo');
    expect(result.post.author.username).toBe('pro_blogger');

    expect(result.comment).toBeNull();
    expect(result.reviewedBy).toBeNull();
    expect(result.status).toBe(ReportStatus.PENDING);
  });

  it('should expose the root comment and replies as moderation context', () => {
    const date = new Date('2026-07-28T00:00:00.000Z');
    const reportedReply = {
      id: 12,
      postId: 6,
      userId: 4,
      parentId: 10,
      content: 'Phản hồi bị báo cáo.',
      createdAt: date,
      user: {
        id: 4,
        username: 'reported_user',
        avatarUrl: null,
      },
    };

    const entity = new ModeratorReportEntity({
      id: 2,
      reporterId: 3,
      targetType: ReportTargetType.COMMENT,
      postId: null,
      commentId: 12,
      reason: ReportReason.HARASSMENT,
      description: null,
      status: ReportStatus.PENDING,
      reviewedById: null,
      reviewedAt: null,
      resolutionNote: null,
      createdAt: date,
      updatedAt: date,
      reporter: {
        id: 3,
        username: 'reporter',
        avatarUrl: null,
      },
      reviewedBy: null,
      post: null,
      comment: {
        ...reportedReply,
        post: {
          id: 6,
          title: 'Bài chứa bình luận',
          thumbnailUrl: null,
          content: '<p>Nội dung bài viết.</p>',
          status: PostStatus.PUBLISH,
          authorId: 8,
          publishedAt: date,
          createdAt: date,
          author: {
            id: 8,
            username: 'author',
            avatarUrl: null,
          },
        },
        parent: {
          id: 10,
          postId: 6,
          userId: 5,
          parentId: null,
          content: 'Bình luận gốc.',
          createdAt: date,
          user: {
            id: 5,
            username: 'root_user',
            avatarUrl: null,
          },
          replies: [reportedReply],
        },
        replies: [],
      },
    });

    const result = instanceToPlain(entity);

    expect(result.comment.parent.content).toBe('Bình luận gốc.');
    expect(result.comment.parent.replies).toHaveLength(1);
    expect(result.comment.parent.replies[0]).toMatchObject({
      id: 12,
      content: 'Phản hồi bị báo cáo.',
      user: {
        id: 4,
        username: 'reported_user',
        avatarUrl: null,
      },
    });
  });
});
