import { PostLike } from '@prisma/client';

export class PostLikeEntity implements PostLike {
    postId: number;
    userId: number;
    createdAt: Date;

    constructor(partial: Partial<PostLikeEntity>) {
        Object.assign(this, partial);
    }
}
