import { BlogOwnerRequest, BlogOwnerRequestStatus } from '@prisma/client';

export class BlogOwnerRequestEntity implements BlogOwnerRequest {
    id: number;
    userId: number;
    reason: string;
    topics: string | null;
    status: BlogOwnerRequestStatus;
    reviewedById: number | null;
    reviewedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;

    constructor(partial: Partial<BlogOwnerRequestEntity>) {
        Object.assign(this, partial);
    }
}
