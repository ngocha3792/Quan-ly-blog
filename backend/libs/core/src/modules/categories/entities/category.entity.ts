import { Category } from '@prisma/client';
import { Exclude, Type } from 'class-transformer';
import { LanguageEntity } from '../../languages/entities/language.entity';
import { CategoryGroupEntity } from './category-group.entity';

export class CategoryEntity implements Category {
  id: number;
  name: string;
  categoryGroupId: number;
  languageId: number;
  createdAt: Date;
  updatedAt: Date;

  @Exclude()
  deletedAt: Date | null;

  @Type(() => LanguageEntity)
  language?: LanguageEntity;

  @Type(() => CategoryGroupEntity)
  categoryGroup?: CategoryGroupEntity;

  constructor(partial: Partial<CategoryEntity>) {
    Object.assign(this, partial);
  }
}
