import { Comment } from '@prisma/client';
import { Type } from 'class-transformer';
import { UserEntity } from '../../users/entities/user.entity';

export class CommentEntity implements Comment {
    id: number;
    postId: number;
    userId: number;
    parentId: number | null;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;

    @Type(() => UserEntity)
    user?: UserEntity;

    constructor(partial: Partial<CommentEntity>) {
        Object.assign(this, partial);
    }
}
