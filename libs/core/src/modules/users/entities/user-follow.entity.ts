import { UserFollow } from '@prisma/client';

export class UserFollowEntity implements UserFollow {
    followerId: number;
    followingId: number;
    createdAt: Date;

    constructor(partial: Partial<UserFollowEntity>) {
        Object.assign(this, partial);
    }
}
