import { Language } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class LanguageEntity implements Language {
    id: number;
    code: string;
    name: string;
    flag: string | null;
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    deletedAt: Date | null;

    constructor(partial: Partial<LanguageEntity>) {
        Object.assign(this, partial);
    }
}
