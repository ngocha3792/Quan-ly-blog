import { instanceToPlain } from 'class-transformer';
import { MediaType, PostStatus } from '@prisma/client';

import { ModeratorPostEntity } from './moderator-post.entity';

describe('ModeratorPostEntity', () => {
  it('should hide raw Prisma relations and deleted fields', () => {
    const date = new Date('2026-07-28T00:00:00.000Z');

    const entity = new ModeratorPostEntity({
      id: 1,
      title: 'Bài viết chờ duyệt',
      thumbnailUrl: null,
      content: 'Nội dung bài viết',
      status: PostStatus.PENDING_REVIEW,
      viewCount: 0,
      publishedAt: null,

      parentPostId: null,
      authorId: 3,
      languageId: 4,

      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,

      createdAt: date,
      updatedAt: date,
      deletedAt: null,

      reviewedBy: undefined,

      media: [
        {
          id: 1,
          postId: 1,
          mediaType: MediaType.IMAGE,
          mediaUrl: 'https://example.com/image.jpg',
          publicId: 'posts/1/image',
          createdAt: date,
        },
      ],

      postCategories: [
        {
          category: {
            id: 13,
            name: 'Công nghệ',
            categoryGroupId: 5,
            languageId: 4,
            createdAt: date,
            updatedAt: date,
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
      translations: [
        {
          id: 1,
          title: 'Bài viết chờ duyệt',
          thumbnailUrl: null,
          status: PostStatus.PENDING_REVIEW,
          parentPostId: null,
          languageId: 4,

          language: {
            id: 4,
            code: 'vi',
            name: 'Tiếng Việt',
            flag: '🇻🇳',
          },
        },

        {
          id: 2,
          title: 'Pending English article',
          thumbnailUrl: null,
          status: PostStatus.PENDING_REVIEW,
          parentPostId: 1,
          languageId: 5,

          language: {
            id: 5,
            code: 'en',
            name: 'English',
            flag: '🇺🇸',
          },
        },
      ],
    });

    const result = instanceToPlain(entity);

    expect(result).not.toHaveProperty('deletedAt');
    expect(result).not.toHaveProperty('reviewedById');
    expect(result).not.toHaveProperty('postCategories');
    expect(result).not.toHaveProperty('postTags');

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe('Công nghệ');

    expect(result.tags).toEqual([
      {
        id: 1,
        name: 'NestJS',
      },
    ]);

    expect(result.media).toHaveLength(1);
    expect(result.media[0].mediaType).toBe(MediaType.IMAGE);
    expect(result.translations).toHaveLength(2);

    expect(result.translations[0]).toEqual(
      expect.objectContaining({
        id: 1,
        languageId: 4,
      }),
    );

    expect(result.translations[1]).toEqual(
      expect.objectContaining({
        id: 2,
        parentPostId: 1,
        languageId: 5,
      }),
    );
  });
});
