import { type User } from '@prisma/client';

export class UserFollowSummaryEntity {
  id: number;
  username: string;
  avatarUrl: string | null;
  bio: string | null;

  constructor(partial: Partial<User>) {
    if (partial) {
      this.id = partial.id!;
      this.username = partial.username!;
      this.avatarUrl = partial.avatarUrl ?? null;
      this.bio = partial.bio ?? null;
    }
  }
}
