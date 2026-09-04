import { UserPostEntity } from './user-post.entity';

describe('UserPostEntity', () => {
  it('should create instance and format likeCount and hide sensitive fields', () => {
    const rawPost = {
      id: 1,
      title: 'Test Post',
      content: 'Content',
      reviewedById: 10,
      deletedAt: new Date(),
      rejectionReason: 'hidden',
      _count: { postLikes: 5 },
      media: [
        {
          id: 1,
          postId: 1,
          mediaType: 'image',
          mediaUrl: 'url',
          createdAt: new Date(),
          publicId: 'secret_public_id',
        } as any,
      ],
    };

    const entity = new UserPostEntity(rawPost);

    expect(entity.id).toBe(1);
    expect(entity.title).toBe('Test Post');
    expect(entity.likeCount).toBe(5);
    expect(entity.media).toBeDefined();
    expect(entity.media?.[0]).not.toHaveProperty('publicId');
  });
});
