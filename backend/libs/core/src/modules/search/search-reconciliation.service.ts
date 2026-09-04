import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { SearchIndexService } from './search-index.service';

/**
 * Bắt các trường hợp lệch giữa Post và search_documents mà các hook
 * real-time (BlogownerPostsService/ModeratorPostsService) không phủ tới:
 *
 * - Tác giả bị Admin khoá/xoá sau khi bài đã PUBLISH.
 * - Language bị deactivate sau khi bài đã PUBLISH.
 * - Bất kỳ post PUBLISH nào drift khỏi index vì lý do khác.
 *
 * Xem SEARCH_2_0_ROADMAP.md mục 7.8.
 */
@Injectable()
export class SearchReconciliationService {
  private readonly logger = new Logger(SearchReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndexService: SearchIndexService,
    private readonly configService: ConfigService,
  ) {}

  private get batchSize(): number {
    return (
      this.configService.get<number>(
        'app.searchReconciliationBatchSize',
      ) ?? 200
    );
  }

  @Cron('0 */15 * * * *')
  async handleCron(): Promise<void> {
    try {
      const missingOrStaleCount = await this.reindexMissingOrStale();
      const removedCount = await this.removeIneligibleDocuments();

      if (missingOrStaleCount > 0 || removedCount > 0) {
        this.logger.log(
          `Search reconciliation: đồng bộ lại ${missingOrStaleCount} post, xoá ${removedCount} search document không còn hợp lệ.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Search reconciliation thất bại',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Post PUBLISH đủ điều kiện public nhưng chưa có SearchDocument,
   * hoặc post đã update sau lần index gần nhất.
   */
  private async reindexMissingOrStale(): Promise<number> {
    const missing = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISH,
        deletedAt: null,
        language: {
          isActive: true,
          deletedAt: null,
        },
        author: {
          status: 'ACTIVE',
          deletedAt: null,
        },
        searchDocument: null,
      },
      select: { id: true },
      take: this.batchSize,
    });

    /**
     * Prisma không hỗ trợ so sánh field-vs-field
     * (post.updatedAt > searchDocument.sourceUpdatedAt) trong `where`
     * thông thường, nên phần "stale" (đã có SearchDocument nhưng nội
     * dung post mới hơn) được quét riêng bằng raw SQL tham số hoá.
     */
    const staleRows = await this.prisma.$queryRaw<
      { id: number }[]
    >`
      SELECT p.id
      FROM posts p
      INNER JOIN search_documents sd ON sd.post_id = p.id
      INNER JOIN languages l ON l.id = p.language_id
        AND l.is_active = true AND l.deleted_at IS NULL
      INNER JOIN users u ON u.id = p.author_id
        AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
      WHERE p.status = 'PUBLISH'
        AND p.deleted_at IS NULL
        AND p.updated_at > sd.source_updated_at
      LIMIT ${this.batchSize}
    `;

    const targetIds = Array.from(
      new Set([
        ...missing.map((post) => post.id),
        ...staleRows.map((row) => row.id),
      ]),
    ).slice(0, this.batchSize);

    for (const postId of targetIds) {
      await this.searchIndexService.syncSearchIndex(postId);
    }

    return targetIds.length;
  }

  /**
   * SearchDocument còn tồn tại nhưng điều kiện public không còn đúng
   * (author bị khoá, language bị deactivate, post không còn PUBLISH...).
   */
  private async removeIneligibleDocuments(): Promise<number> {
    const ineligible = await this.prisma.$queryRaw<
      { post_id: number }[]
    >`
      SELECT sd.post_id
      FROM search_documents sd
      LEFT JOIN posts p ON p.id = sd.post_id
      LEFT JOIN languages l ON l.id = p.language_id
      LEFT JOIN users u ON u.id = p.author_id
      WHERE p.id IS NULL
        OR p.status != 'PUBLISH'
        OR p.deleted_at IS NOT NULL
        OR l.id IS NULL
        OR l.is_active = false
        OR l.deleted_at IS NOT NULL
        OR u.id IS NULL
        OR u.status != 'ACTIVE'
        OR u.deleted_at IS NOT NULL
      LIMIT ${this.batchSize}
    `;

    if (ineligible.length === 0) {
      return 0;
    }

    await this.prisma.searchDocument.deleteMany({
      where: {
        postId: { in: ineligible.map((row) => row.post_id) },
      },
    });

    return ineligible.length;
  }
}
