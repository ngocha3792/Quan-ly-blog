import { Post, PostStatus } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';
import { UserEntity } from '../../users/entities/user.entity';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { LanguageEntity } from '../../languages/entities/language.entity';

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

    @Exclude() // 🛡️ Thông tin review chỉ dành cho admin
    reviewedById: number | null;

    @Exclude()
    reviewedAt: Date | null;

    @Exclude()
    rejectionReason: string | null;

    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    deletedAt: Date | null;

    @Type(() => UserEntity)
    author?: UserEntity;

    @Type(() => CategoryEntity)
    category?: CategoryEntity;

    @Type(() => LanguageEntity)
    language?: LanguageEntity;

    // Prisma relations raw data
    @Exclude()
    postTags?: any[];

    // Flatten tags for cleaner API response
    @Expose()
    get tags(): { id: number; name: string }[] | undefined {
        if (!this.postTags) return undefined;
        return this.postTags.map(pt => ({
            id: pt.tag?.id,
            name: pt.tag?.name
        }));
    }

    constructor(partial: Partial<PostEntity>) {
        Object.assign(this, partial);
    }
}
