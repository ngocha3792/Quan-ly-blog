import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoryGroupsService } from './category-groups.service';

@Module({
  providers: [CategoriesService, CategoryGroupsService],
  exports: [CategoriesService, CategoryGroupsService],
})
export class CategoriesModule { }

