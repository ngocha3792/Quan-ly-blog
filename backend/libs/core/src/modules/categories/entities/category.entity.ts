import { Category } from '@prisma/client';
import { Type } from 'class-transformer';
import { LanguageEntity } from '../../languages/entities/language.entity';

export class CategoryEntity implements Category {
    id: number;
    name: string;
    languageId: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;

    @Type(() => LanguageEntity)
    language?: LanguageEntity;

    constructor(partial: Partial<CategoryEntity>) {
        Object.assign(this, partial);
    }
}
