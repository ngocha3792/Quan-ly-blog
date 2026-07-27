import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreatePostDto, GetPostsDto, UpdatePostDto } from './dto';
import { PostEntity } from './entities';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import {
  PostNotFoundException,
  TagLimitExceptions,
} from '@app/core/common/exceptions';
import { PostStatus, Prisma } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: number, createPostDto: CreatePostDto) {
    const { categoryIds, tagIds, tagNames, ...postData } = createPostDto;

    const finalCategoryIds = await this.validateCategories(
      categoryIds,
      postData.languageId,
    );

    const finalTagIds = await this.resolveTags(tagIds, tagNames);

    if (finalTagIds.length > 5) {
      throw new TagLimitExceptions(5);
    }

    const data: Prisma.PostUncheckedCreateInput = {
      ...postData,
      authorId,
      status: postData.status ?? PostStatus.DRAFT,
      postCategories: {
        create: finalCategoryIds.map((categoryId) => ({
          categoryId,
        })),
      },
    };

    if (finalTagIds.length > 0) {
      data.postTags = {
        create: finalTagIds.map((tagId) => ({ tagId })),
      };
    }

    const post = await this.prisma.post.create({
      data,
      include: {
        postCategories: {
          include: {
            category: true,
          },
        },
        postTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return new PostEntity(post);
  }

  async findAll(
    query: GetPostsDto,
    paginationParams: PaginationParams,
    include?: Prisma.PostInclude,
    orderBy:
      | Prisma.PostOrderByWithRelationInput
      | Prisma.PostOrderByWithRelationInput[] = {
      createdAt: 'desc',
    },
  ): Promise<PaginatedResult<PostEntity>> {
    const {
      search,
      categoryId,
      languageId,
      authorId,
      parentPostId,
      status,
      tagId,
      tagName,
      bookmarkedByUserId,
    } = query;

    const { skip, take, page } = paginationParams;

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (categoryId) {
      where.postCategories = {
        some: {
          categoryId,
        },
      };
    }

    if (languageId) {
      where.languageId = languageId;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (parentPostId) {
      where.parentPostId = parentPostId;
    }

    if (status) {
      where.status = status;
    }

    if (tagId) {
      where.postTags = {
        some: { tagId },
      };
    } else if (tagName) {
      const tag = await this.prisma.tag.findFirst({
        where: {
          name: tagName,
          deletedAt: null,
        },
      });

      if (tag) {
        where.postTags = {
          some: {
            tagId: tag.id,
          },
        };
      } else {
        where.id = -1;
      }
    }

    if (bookmarkedByUserId) {
      where.postBookmarks = {
        some: {
          userId: bookmarkedByUserId,
        },
      };
    }

    const [posts, totalItems] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take,
        orderBy,
        include,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: posts.map((post) => new PostEntity(post)),
      meta: {
        totalItems,
        itemCount: posts.length,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take),
        currentPage: page,
      },
    };
  }

  async findOne(id: number, include?: Prisma.PostInclude) {
    const post = await this.prisma.post.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include,
    });

    if (!post) {
      throw new PostNotFoundException(id.toString());
    }

    return new PostEntity(post);
  }

  async update(id: number, updatePostDto: UpdatePostDto) {
    const existingPost = await this.findOne(id);

    const { categoryIds, tagIds, tagNames, ...postData } = updatePostDto;

    if (postData.languageId !== undefined && categoryIds === undefined) {
      throw new BadRequestException(
        'Khi đổi ngôn ngữ bài viết, bạn phải gửi lại categoryIds phù hợp với ngôn ngữ mới.',
      );
    }

    const data: Prisma.PostUncheckedUpdateInput = {
      ...postData,
    };

    if (categoryIds !== undefined) {
      const languageId = postData.languageId ?? existingPost.languageId;

      const finalCategoryIds = await this.validateCategories(
        categoryIds,
        languageId,
      );

      data.postCategories = {
        deleteMany: {},
        create: finalCategoryIds.map((categoryId) => ({
          categoryId,
        })),
      };
    }

    if (tagIds !== undefined || tagNames !== undefined) {
      const finalTagIds = await this.resolveTags(tagIds, tagNames);

      if (finalTagIds.length > 5) {
        throw new TagLimitExceptions(5);
      }

      data.postTags = {
        deleteMany: {},
        create: finalTagIds.map((tagId) => ({ tagId })),
      };
    }

    const updatedPost = await this.prisma.post.update({
      where: { id },
      data,
      include: {
        postCategories: {
          include: {
            category: true,
          },
        },
        postTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return new PostEntity(updatedPost);
  }

  async remove(id: number) {
    await this.findOne(id);

    const deletedPost = await this.prisma.post.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return new PostEntity(deletedPost);
  }

  async restore(id: number) {
    const post = await this.prisma.post.findFirst({
      where: { id },
    });

    if (!post) {
      throw new PostNotFoundException(id.toString());
    }

    const restoredPost = await this.prisma.post.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    });

    return new PostEntity(restoredPost);
  }

  private async validateCategories(
    categoryIds: number[],
    languageId: number,
  ): Promise<number[]> {
    const uniqueCategoryIds = Array.from(new Set(categoryIds));

    if (uniqueCategoryIds.length === 0) {
      throw new BadRequestException('Bài viết phải có ít nhất một danh mục.');
    }

    const categories = await this.prisma.category.findMany({
      where: {
        id: {
          in: uniqueCategoryIds,
        },
        languageId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (categories.length !== uniqueCategoryIds.length) {
      throw new BadRequestException(
        'Có danh mục không tồn tại, đã bị xóa hoặc không cùng ngôn ngữ với bài viết.',
      );
    }

    return uniqueCategoryIds;
  }

  private async resolveTags(
    tagIds?: number[],
    tagNames?: string[],
  ): Promise<number[]> {
    const resolvedTagIds = new Set<number>(tagIds ?? []);

    if (tagNames && tagNames.length > 0) {
      const normalizedNames = Array.from(
        new Set(
          tagNames.map((name) => name.trim()).filter((name) => name.length > 0),
        ),
      );

      if (normalizedNames.length > 0) {
        const existingTags = await this.prisma.tag.findMany({
          where: {
            name: {
              in: normalizedNames,
            },
          },
        });

        const existingTagNames = new Set(existingTags.map((tag) => tag.name));

        const newTagNames = normalizedNames.filter(
          (name) => !existingTagNames.has(name),
        );

        if (newTagNames.length > 0) {
          await this.prisma.tag.createMany({
            data: newTagNames.map((name) => ({ name })),
            skipDuplicates: true,
          });
        }

        const allTags = await this.prisma.tag.findMany({
          where: {
            name: {
              in: normalizedNames,
            },
          },
        });

        allTags.forEach((tag) => resolvedTagIds.add(tag.id));
      }
    }

    return Array.from(resolvedTagIds);
  }
}
