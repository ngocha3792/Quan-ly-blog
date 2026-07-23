import { Tag } from '@prisma/client';

export class TagEntity implements Tag {
    id: number;
    name: string;
    createdAt: Date;
    deletedAt: Date | null;

    constructor(partial: Partial<TagEntity>) {
        Object.assign(this, partial);
    }
}
