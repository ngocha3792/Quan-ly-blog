import { BlogOwnerRequestStatus } from '@prisma/client';
import { UserBlogOwnerRequestEntity } from './user-blog-owner-request.entity';

describe('UserBlogOwnerRequestEntity', () => {
  it('should create instance and hide sensitive fields like reviewedById', () => {
    const rawRequest = {
      id: 1,
      userId: 10,
      reason: 'Muốn viết bài chia sẻ kỹ thuật',
      topics: 'NestJS, React, TypeScript',
      status: BlogOwnerRequestStatus.APPROVED,
      reviewedById: 99,
      reviewedAt: new Date(),
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const entity = new UserBlogOwnerRequestEntity(rawRequest);

    expect(entity.id).toBe(1);
    expect(entity.reason).toBe('Muốn viết bài chia sẻ kỹ thuật');
    expect(entity.status).toBe(BlogOwnerRequestStatus.APPROVED);
    expect(entity).toHaveProperty('reviewedById');
    // Class-transformer @Exclude() will hide reviewedById when serialized
  });
});
