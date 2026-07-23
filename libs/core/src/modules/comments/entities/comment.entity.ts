import { Comment } from '@prisma/client';

export class CommentEntity implements Comment {
    id: number;
    postId: number;
    userId: number;
    parentId: number | null;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;

    constructor(partial: Partial<CommentEntity>) {
        Object.assign(this, partial);
    }
}
