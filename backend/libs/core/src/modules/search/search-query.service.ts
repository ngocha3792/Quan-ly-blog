import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { SearchSortOption } from './dto/search-posts.dto';

export interface SearchQueryFilters {
  languageId?: number;
  categoryId?: number;
  tagId?: number;
  authorId?: number;
  sort?: SearchSortOption;
}

export interface RankedPostId {
  postId: number;
  rank: number;
}

/**
 * Engine POSTGRES_FTS: tsvector/GIN có sẵn của PostgreSQL.
 *
 * KHÔNG phải TF-IDF/BM25 — xem SEARCH_2_0_ROADMAP.md mục 10.4 về việc
 * không gọi ts_rank là BM25 khi chưa triển khai đúng công thức đó.
 */
@Injectable()
export class SearchQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private buildFilterConditions(
    filters: SearchQueryFilters,
  ): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`sd.status = 'PUBLISH'`,
    ];

    if (filters.languageId) {
      conditions.push(
        Prisma.sql`sd.language_id = ${filters.languageId}`,
      );
    }

    if (filters.categoryId) {
      conditions.push(Prisma.sql`
        EXISTS (
          SELECT 1 FROM post_categories pc
          WHERE pc.post_id = p.id
            AND pc.category_id = ${filters.categoryId}
        )
      `);
    }

    if (filters.tagId) {
      conditions.push(Prisma.sql`
        EXISTS (
          SELECT 1 FROM post_tags pt
          WHERE pt.post_id = p.id
            AND pt.tag_id = ${filters.tagId}
        )
      `);
    }

    if (filters.authorId) {
      conditions.push(
        Prisma.sql`p.author_id = ${filters.authorId}`,
      );
    }

    return conditions;
  }

  private buildOrderBy(sort?: SearchSortOption): Prisma.Sql {
    switch (sort) {
      case SearchSortOption.NEWEST:
        return Prisma.sql`ORDER BY p.published_at DESC NULLS LAST, p.id DESC`;
      case SearchSortOption.POPULAR:
        return Prisma.sql`ORDER BY p.view_count DESC, p.id DESC`;
      case SearchSortOption.RELEVANCE:
      default:
        return Prisma.sql`ORDER BY rank DESC, p.published_at DESC NULLS LAST, p.id DESC`;
    }
  }

  /**
   * Trả về danh sách postId đã rank + tổng số kết quả.
   *
   * `q` luôn đi qua websearch_to_tsquery dưới dạng parameter binding —
   * không nối chuỗi trực tiếp vào SQL.
   */
  async search(
    q: string,
    filters: SearchQueryFilters,
    skip: number,
    take: number,
  ): Promise<{ items: RankedPostId[]; totalItems: number }> {
    const conditions = this.buildFilterConditions(filters);
    const whereClause = Prisma.join(conditions, ' AND ');
    const orderByClause = this.buildOrderBy(filters.sort);

    const items = await this.prisma.$queryRaw<
      { postId: number; rank: number }[]
    >`
      SELECT
        p.id AS "postId",
        ts_rank(sd.search_vector, query) AS rank
      FROM search_documents sd
      INNER JOIN posts p ON p.id = sd.post_id,
        websearch_to_tsquery('simple', ${q}) query
      WHERE sd.search_vector @@ query
        AND ${whereClause}
      ${orderByClause}
      LIMIT ${take} OFFSET ${skip}
    `;

    const totalItemsRaw = await this.prisma.$queryRaw<
      { count: bigint }[]
    >`
      SELECT COUNT(*)::bigint AS count
      FROM search_documents sd
      INNER JOIN posts p ON p.id = sd.post_id,
        websearch_to_tsquery('simple', ${q}) query
      WHERE sd.search_vector @@ query
        AND ${whereClause}
    `;

    return {
      items,
      totalItems: Number(totalItemsRaw[0]?.count ?? 0),
    };
  }
}
