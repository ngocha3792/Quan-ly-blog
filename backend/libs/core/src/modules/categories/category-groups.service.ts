import { Injectable } from '@nestjs/common';
import {
  CategoryGroupAlreadyExistsException,
  CategoryGroupNotFoundException,
} from '@app/core/common/exceptions';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateCategoryGroupDto } from './dto/create-category-group.dto';
import { UpdateCategoryGroupDto } from './dto/update-category-group.dto';
import { GetCategoryGroupsDto } from './dto/get-category-groups.dto';
import { CategoryGroupEntity } from './entities/category-group.entity';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoryGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryGroupDto: CreateCategoryGroupDto) {
    const { code } = createCategoryGroupDto;

    const existingGroup = await this.prisma.categoryGroup.findFirst({
      where: { code, deletedAt: null },
    });

    if (existingGroup) {
      throw new CategoryGroupAlreadyExistsException(code);
    }

    const categoryGroup = await this.prisma.categoryGroup.create({
      data: { code },
    });

    return new CategoryGroupEntity(categoryGroup);
  }

  async findAll(
    query: GetCategoryGroupsDto,
    paginationParams: PaginationParams,
    include?: Prisma.CategoryGroupInclude,
  ): Promise<PaginatedResult<CategoryGroupEntity>> {
    const { search } = query;
    const { skip, take, page } = paginationParams;

    const where: Prisma.CategoryGroupWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.code = { contains: search, mode: 'insensitive' };
    }

    const [categoryGroups, totalItems] = await Promise.all([
      this.prisma.categoryGroup.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include,
      }),
      this.prisma.categoryGroup.count({ where }),
    ]);

    return {
      items: categoryGroups.map((group) => new CategoryGroupEntity(group)),
      meta: {
        totalItems,
        itemCount: categoryGroups.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take),
        currentPage: page,
      },
    };
  }

  async findOne(id: number, include?: Prisma.CategoryGroupInclude) {
    const categoryGroup = await this.prisma.categoryGroup.findFirst({
      where: { id, deletedAt: null },
      include,
    });

    if (!categoryGroup) {
      throw new CategoryGroupNotFoundException(id);
    }

    return new CategoryGroupEntity(categoryGroup);
  }

  async update(id: number, updateCategoryGroupDto: UpdateCategoryGroupDto) {
    await this.findOne(id);

    if (updateCategoryGroupDto.code) {
      const existingGroup = await this.prisma.categoryGroup.findFirst({
        where: {
          code: updateCategoryGroupDto.code,
          id: { not: id },
          deletedAt: null,
        },
      });

      if (existingGroup) {
        throw new CategoryGroupAlreadyExistsException(
          updateCategoryGroupDto.code,
        );
      }
    }

    const updatedGroup = await this.prisma.categoryGroup.update({
      where: { id },
      data: updateCategoryGroupDto,
    });

    return new CategoryGroupEntity(updatedGroup);
  }

  async remove(id: number) {
    await this.findOne(id);

    const deletedGroup = await this.prisma.categoryGroup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return new CategoryGroupEntity(deletedGroup);
  }

  async restore(id: number) {
    const categoryGroup = await this.prisma.categoryGroup.findFirst({
      where: { id },
    });

    if (!categoryGroup) {
      throw new CategoryGroupNotFoundException(id);
    }

    const restoredGroup = await this.prisma.categoryGroup.update({
      where: { id },
      data: { deletedAt: null },
    });

    return new CategoryGroupEntity(restoredGroup);
  }
}
