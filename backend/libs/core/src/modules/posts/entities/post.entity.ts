import { Post, PostStatus } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';
import { UserEntity } from '../../users/entities/user.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';

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

    @Type(() => UserEntity)
    author?: UserEntity;

    @Type(() => CategoryEntity)
    category?: CategoryEntity;

    // Prisma relations raw data
    @Exclude()
    postTags?: any[];

    // Flatten tags for cleaner API response
    @Expose()
    get tags(): any[] {
        if (!this.postTags) return undefined as any;
        return this.postTags.map(pt => ({
            id: pt.tag?.id,
            name: pt.tag?.name
        }));
    }

    constructor(partial: Partial<PostEntity>) {
        Object.assign(this, partial);
    }
}
