import { UserFollowSummaryEntity } from './user-follow-summary.entity';

describe('UserFollowSummaryEntity', () => {
  it('should initialize correctly with provided properties', () => {
    const summary = new UserFollowSummaryEntity({
      id: 10,
      username: 'testuser',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'Developer bio',
      email: 'secret@example.com',
      role: 'NORMAL',
    } as any);

    expect(summary.id).toBe(10);
    expect(summary.username).toBe('testuser');
    expect(summary.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(summary.bio).toBe('Developer bio');
    expect((summary as any).email).toBeUndefined();
    expect((summary as any).role).toBeUndefined();
  });
});
