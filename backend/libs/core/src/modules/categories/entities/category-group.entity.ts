import { CategoryGroup } from '@prisma/client';
import { Exclude, Type } from 'class-transformer';
import { CategoryEntity } from './category.entity';

export class CategoryGroupEntity implements CategoryGroup {
  id: number;
  code: string;
  createdAt: Date;
  updatedAt: Date;

  deletedAt: Date | null;

  @Type(() => CategoryEntity)
  categories?: CategoryEntity[];

  constructor(partial: Partial<CategoryGroupEntity>) {
    Object.assign(this, partial);
  }
}
