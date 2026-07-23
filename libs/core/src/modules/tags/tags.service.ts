import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateTagDto, UpdateTagDto, GetTagsDto } from './dto';
import { TagEntity } from './entities/tag.entity';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { Prisma } from '@prisma/client';
import { TagNotFoundException, TagAlreadyExistsException } from '@app/core/common/exceptions';

@Injectable()
export class TagsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createTagDto: CreateTagDto) {
        const { name } = createTagDto;
        const normalizedName = name.trim();

        const existingTag = await this.prisma.tag.findFirst({
            where: { name: normalizedName, deletedAt: null }
        });

        if (existingTag) {
            throw new TagAlreadyExistsException(normalizedName);
        }

        const tag = await this.prisma.tag.create({
            data: { name: normalizedName }
        });

        return new TagEntity(tag);
    }

    async findAll(query: GetTagsDto, paginationParams: PaginationParams): Promise<PaginatedResult<TagEntity>> {
        const { search } = query;
        const { skip, take, page } = paginationParams;

        const where: Prisma.TagWhereInput = { deletedAt: null };

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        const [tags, totalItems] = await Promise.all([
            this.prisma.tag.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.tag.count({ where }),
        ]);

        return {
            items: tags.map(tag => new TagEntity(tag)),
            meta: {
                totalItems,
                itemCount: tags.length,
                itemsPerPage: take,
                totalPages: Math.ceil(totalItems / take),
                currentPage: page,
            }
        };
    }

    async findOne(id: number) {
        const tag = await this.prisma.tag.findFirst({
            where: { id, deletedAt: null }
        });

        if (!tag) {
            throw new TagNotFoundException(id.toString());
        }

        return new TagEntity(tag);
    }

    async update(id: number, updateTagDto: UpdateTagDto) {
        await this.findOne(id);

        if (updateTagDto.name) {
            const normalizedName = updateTagDto.name.trim();
            const existingTag = await this.prisma.tag.findFirst({
                where: {
                    name: normalizedName,
                    id: { not: id },
                    deletedAt: null
                }
            });

            if (existingTag) {
                throw new TagAlreadyExistsException(normalizedName);
            }
            updateTagDto.name = normalizedName;
        }

        const updatedTag = await this.prisma.tag.update({
            where: { id },
            data: updateTagDto
        });

        return new TagEntity(updatedTag);
    }

    async remove(id: number) {
        await this.findOne(id);

        const deletedTag = await this.prisma.tag.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        return new TagEntity(deletedTag);
    }



    async restore(id: number) {
        const tag = await this.prisma.tag.findFirst({
            where: { id }
        });

        if (!tag) {
            throw new TagNotFoundException(id.toString());
        }

        const restoredTag = await this.prisma.tag.update({
            where: { id },
            data: { deletedAt: null }
        });

        return new TagEntity(restoredTag);
    }
}
