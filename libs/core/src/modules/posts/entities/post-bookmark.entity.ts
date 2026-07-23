import { PostBookmark } from '@prisma/client';

export class PostBookmarkEntity implements PostBookmark {
    postId: number;
    userId: number;
    createdAt: Date;

    constructor(partial: Partial<PostBookmarkEntity>) {
        Object.assign(this, partial);
    }
}
