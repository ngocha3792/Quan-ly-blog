import { Language } from '@prisma/client';

export class LanguageEntity implements Language {
    id: number;
    code: string;
    name: string;
    flag: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;

    constructor(partial: Partial<LanguageEntity>) {
        Object.assign(this, partial);
    }
}
