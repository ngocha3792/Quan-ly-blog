import { Tag } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class TagEntity implements Tag {
    id: number;
    name: string;
    createdAt: Date;

    @Exclude()
    deletedAt: Date | null;

    constructor(partial: Partial<TagEntity>) {
        Object.assign(this, partial);
    }
}
