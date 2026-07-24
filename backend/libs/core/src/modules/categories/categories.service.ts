import { Injectable } from '@nestjs/common';
import { CategoryAlreadyExistsException, CategoryNotFoundException } from '@app/core/common/exceptions';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, GetCategoriesDto } from './dto';
import { CategoryEntity } from './entities/category.entity';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createCategoryDto: CreateCategoryDto) {
        const { name, languageId } = createCategoryDto;

        const existingCategory = await this.prisma.category.findFirst({
            where: { name, languageId, deletedAt: null }
        });

        if (existingCategory) {
            throw new CategoryAlreadyExistsException(name);
        }

        const category = await this.prisma.category.create({
            data: {
                name,
                languageId,
            }
        });

        return new CategoryEntity(category);
    }

    async findAll(query: GetCategoriesDto, paginationParams: PaginationParams, include?: Prisma.CategoryInclude): Promise<PaginatedResult<CategoryEntity>> {
        const { search, languageId } = query;
        const { skip, take, page } = paginationParams;

        const where: Prisma.CategoryWhereInput = {
            deletedAt: null,
        };

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        if (languageId) {
            where.languageId = languageId;
        }

        const [categories, totalItems] = await Promise.all([
            this.prisma.category.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include,
            }),
            this.prisma.category.count({ where }),
        ]);

        return {
            items: categories.map(category => new CategoryEntity(category)),
            meta: {
                totalItems,
                itemCount: categories.length,
                itemsPerPage: take,
                totalPages: Math.ceil(totalItems / take),
                currentPage: page,
            },
        };
    }

    async findOne(id: number, include?: Prisma.CategoryInclude) {
        const category = await this.prisma.category.findFirst({
            where: { id, deletedAt: null },
            include,
        });

        if (!category) {
            throw new CategoryNotFoundException(id);
        }

        return new CategoryEntity(category);
    }

    async update(id: number, updateCategoryDto: UpdateCategoryDto) {
        const category = await this.findOne(id);

        if (updateCategoryDto.name || updateCategoryDto.languageId) {
            const name = updateCategoryDto.name || category.name;
            const languageId = updateCategoryDto.languageId || category.languageId;

            const existingCategory = await this.prisma.category.findFirst({
                where: {
                    name,
                    languageId,
                    id: { not: id },
                    deletedAt: null
                }
            });

            if (existingCategory) {
                throw new CategoryAlreadyExistsException(name);
            }
        }

        const updatedCategory = await this.prisma.category.update({
            where: { id },
            data: updateCategoryDto,
        });

        return new CategoryEntity(updatedCategory);
    }

    async remove(id: number) {
        await this.findOne(id);

        const deletedCategory = await this.prisma.category.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return new CategoryEntity(deletedCategory);
    }
    async restore(id: number) {
        const category = await this.prisma.category.findFirst({
            where: { id }
        });
        if (!category) {
            throw new CategoryNotFoundException(id);
        }

        const restoredCategory = await this.prisma.category.update({
            where: { id },
            data: { deletedAt: null },
        });

        return new CategoryEntity(restoredCategory);
    }
}
