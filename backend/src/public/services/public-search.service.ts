import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import {
  LanguagesService,
  PostsService,
  SearchPostsDto,
  SearchQueryService,
  SearchSortOption,
} from '@app/core';
import type { PaginationParams } from '@app/core';
import { PublicPostEntity } from '../entities';

const PUBLIC_POST_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
    },
  },
  postCategories: {
    include: {
      category: {
        include: {
          language: true,
          categoryGroup: true,
        },
      },
    },
  },
  language: true,
  postTags: {
    include: {
      tag: true,
    },
  },
  media: true,
  _count: {
    select: {
      postLikes: true,
    },
  },
} satisfies Prisma.PostInclude;

const PUBLIC_POST_WHERE = {
  status: PostStatus.PUBLISH,
  deletedAt: null,
  language: {
    is: {
      isActive: true,
      deletedAt: null,
    },
  },
} satisfies Prisma.PostWhereInput;

export interface SearchMeta {
  query: string;
  engine: 'POSTGRES_FTS' | 'CONTAINS';
  tookMs: number;
}

@Injectable()
export class PublicSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
    private readonly languagesService: LanguagesService,
    private readonly searchQueryService: SearchQueryService,
    private readonly configService: ConfigService,
  ) {}

  private get v2Enabled(): boolean {
    return (
      this.configService.get<boolean>('app.searchV2Enabled') ?? true
    );
  }

  async search(
    query: SearchPostsDto,
    paginationParams: PaginationParams,
    langCode: string | null,
  ) {
    const startedAt = Date.now();

    let languageId = query.languageId;

    if (!languageId && (query.lang || langCode)) {
      languageId = await this.languagesService.getActiveIdByCode(
        query.lang ?? langCode,
      );
    }

    if (!this.v2Enabled) {
      return this.searchWithFallback(query.q, query, paginationParams, startedAt);
    }

    const { items: rankedIds, totalItems } =
      await this.searchQueryService.search(
        query.q,
        {
          languageId,
          categoryId: query.categoryId,
          tagId: query.tagId,
          authorId: query.authorId,
          sort: query.sort ?? SearchSortOption.RELEVANCE,
        },
        paginationParams.skip,
        paginationParams.take,
      );

    const items = await this.hydrateRankedPosts(rankedIds);

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: paginationParams.take,
        totalPages: Math.ceil(totalItems / paginationParams.take),
        currentPage: paginationParams.page,
      },
      search: {
        query: query.q,
        engine: 'POSTGRES_FTS',
        tookMs: Date.now() - startedAt,
      } satisfies SearchMeta,
    };
  }

  /**
   * Fallback khi SEARCH_V2_ENABLED=false — dùng lại hành vi
   * title-contains cũ của PostsService.findAll().
   */
  private async searchWithFallback(
    q: string,
    query: SearchPostsDto,
    paginationParams: PaginationParams,
    startedAt: number,
  ) {
    const result = await this.postsService.findAll(
      {
        search: q,
        categoryId: query.categoryId,
        tagId: query.tagId,
        authorId: query.authorId,
        languageId: query.languageId,
        status: PostStatus.PUBLISH,
      },
      paginationParams,
      PUBLIC_POST_INCLUDE,
      { createdAt: 'desc' },
      PUBLIC_POST_WHERE,
    );

    return {
      items: result.items.map((post) => new PublicPostEntity(post)),
      meta: result.meta,
      search: {
        query: q,
        engine: 'CONTAINS',
        tookMs: Date.now() - startedAt,
      } satisfies SearchMeta,
    };
  }

  private async hydrateRankedPosts(
    rankedIds: { postId: number; rank: number }[],
  ): Promise<PublicPostEntity[]> {
    if (rankedIds.length === 0) {
      return [];
    }

    const ids = rankedIds.map((item) => item.postId);

    const posts = await this.prisma.post.findMany({
      where: {
        id: { in: ids },
        ...PUBLIC_POST_WHERE,
      },
      include: PUBLIC_POST_INCLUDE,
    });

    const postMap = new Map(posts.map((post) => [post.id, post]));

    /**
     * findMany WHERE id IN (...) không giữ thứ tự ranking —
     * phải rebuild lại theo đúng thứ tự rankedIds.
     */
    return ids
      .map((id) => postMap.get(id))
      .filter(
        (post): post is (typeof posts)[number] => post !== undefined,
      )
      .map((post) => new PublicPostEntity(post));
  }
}
