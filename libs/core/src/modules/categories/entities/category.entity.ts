import { Category } from '@prisma/client';

export class CategoryEntity implements Category {
    id: number;
    name: string;
    languageId: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;

    constructor(partial: Partial<CategoryEntity>) {
        Object.assign(this, partial);
    }
}
