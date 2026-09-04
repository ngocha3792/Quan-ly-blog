import { instanceToPlain } from 'class-transformer';
import { MediaType, PostStatus } from '@prisma/client';

import { PublicPostEntity } from './public-post.entity';

describe('PublicPostEntity', () => {
  it('should hide moderation and raw Prisma relation fields', () => {
    const entity = new PublicPostEntity({
      id: 1,
      title: 'Bài viết public',
      thumbnailUrl: null,
      content: 'Nội dung bài viết',
      status: PostStatus.PUBLISH,
      viewCount: 10,
      publishedAt: new Date('2026-07-28T00:00:00.000Z'),

      parentPostId: null,
      authorId: 3,
      languageId: 1,

      reviewedById: 2,
      reviewedAt: new Date('2026-07-28T00:00:00.000Z'),
      rejectionReason: null,

      createdAt: new Date('2026-07-28T00:00:00.000Z'),
      updatedAt: new Date('2026-07-28T00:00:00.000Z'),
      deletedAt: null,

      _count: {
        postLikes: 42,
      },

      media: [
        {
          id: 10,
          postId: 1,
          mediaType: MediaType.IMAGE,
          mediaUrl: 'https://example.com/img.png',
          publicId: 'secret_cloudinary_id',
          createdAt: new Date('2026-07-28T00:00:00.000Z'),
          deletedAt: null,
        },
      ] as any,

      postCategories: [
        {
          category: {
            id: 1,
            name: 'Công nghệ',
            categoryGroupId: 1,
            languageId: 1,
            createdAt: new Date('2026-07-28T00:00:00.000Z'),
            updatedAt: new Date('2026-07-28T00:00:00.000Z'),
            deletedAt: null,
          },
        },
      ],

      postTags: [
        {
          tag: {
            id: 1,
            name: 'NestJS',
          },
        },
      ],
    });

    const result = instanceToPlain(entity);

    expect(result).not.toHaveProperty('reviewedById');
    expect(result).not.toHaveProperty('reviewedAt');
    expect(result).not.toHaveProperty('rejectionReason');
    expect(result).not.toHaveProperty('deletedAt');

    expect(result).not.toHaveProperty('postCategories');
    expect(result).not.toHaveProperty('postTags');
    expect(result).not.toHaveProperty('_count');

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe('Công nghệ');

    expect(result.tags).toEqual([
      {
        id: 1,
        name: 'NestJS',
      },
    ]);

    // likeCount lấy từ _count.postLikes
    expect(result.likeCount).toBe(42);

    // media đã loại publicId và deletedAt
    expect(result.media).toHaveLength(1);
    expect(result.media[0].mediaUrl).toBe('https://example.com/img.png');
    expect(result.media[0]).not.toHaveProperty('publicId');
    expect(result.media[0]).not.toHaveProperty('deletedAt');
  });
});
