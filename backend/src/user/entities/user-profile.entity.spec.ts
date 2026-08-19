import { instanceToPlain } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';
import { UserProfileEntity } from './user-profile.entity';

describe('UserProfileEntity', () => {
  it('should hide deletedAt, lockedById, lockedAt, lockReason, passwordHash and show clean followers', () => {
    const entity = new UserProfileEntity({
      id: 1,
      username: 'hoai',
      email: 'hoai@example.com',
      passwordHash: 'secret_hash',
      role: UserRole.NORMAL,
      status: UserStatus.ACTIVE,
      bio: 'Hello world',
      avatarUrl: 'https://example.com/avatar.jpg',
      lockedAt: new Date('2026-07-28T00:00:00.000Z'),
      lockedById: 99,
      lockReason: 'Spamming',
      deletedAt: null,
      createdAt: new Date('2026-07-28T00:00:00.000Z'),
      updatedAt: new Date('2026-07-28T00:00:00.000Z'),
      following: [
        {
          followerId: 2,
          followingId: 1,
          follower: {
            id: 2,
            username: 'alice',
            email: 'alice@example.com',
            avatarUrl: 'https://example.com/alice.jpg',
            bio: 'Alice bio',
            passwordHash: 'secret_alice',
            deletedAt: null,
          },
        },
      ] as any,
    });

    const result = instanceToPlain(entity);

    // Kiểm tra ẩn các trường nhạy cảm & kiểm duyệt
    expect(result).not.toHaveProperty('deletedAt');
    expect(result).not.toHaveProperty('lockedById');
    expect(result).not.toHaveProperty('lockedAt');
    expect(result).not.toHaveProperty('lockReason');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('following');

    // Kiểm tra hiển thị thông tin cơ bản
    expect(result.id).toBe(1);
    expect(result.username).toBe('hoai');
    expect(result.email).toBe('hoai@example.com');
    expect(result.bio).toBe('Hello world');

    // Kiểm tra danh sách người theo dõi (followers)
    expect(result.followers).toHaveLength(1);
    expect(result.followers[0]).toEqual({
      id: 2,
      username: 'alice',
      avatarUrl: 'https://example.com/alice.jpg',
      bio: 'Alice bio',
    });
  });
});
