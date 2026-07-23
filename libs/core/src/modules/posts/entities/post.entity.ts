import { Post, PostStatus } from '@prisma/client';

export class PostEntity implements Post {
    id: number;
    title: string;
    thumbnailUrl: string | null;
    content: string;
    status: PostStatus;
    viewCount: number;
    parentPostId: number | null;
    authorId: number;
    categoryId: number;
    languageId: number;
    reviewedById: number | null;
    reviewedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;

    constructor(partial: Partial<PostEntity>) {
        Object.assign(this, partial);
    }
}
