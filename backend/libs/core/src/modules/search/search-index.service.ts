import { Injectable, Logger } from '@nestjs/common';
import { PostStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '@app/core/core/prisma/prisma.service';

/**
 * Điều kiện để một Post được đưa vào search_documents (public FTS index).
 *
 * Xem SEARCH_2_0_ROADMAP.md mục 7.4.
 */
export interface SearchEligibilityCheck {
  id: number;
  languageId: number;
  status: PostStatus;
  deletedAt: Date | null;
  title: string;
  content: string;
  updatedAt: Date;
  language: {
    isActive: boolean;
    deletedAt: Date | null;
  } | null;
  author: {
    status: UserStatus;
    deletedAt: Date | null;
  } | null;
}

@Injectable()
export class SearchIndexService {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đồng bộ index cho MỘT post.
   *
   * Tự quyết định upsert hay xoá khỏi index — caller không cần biết
   * logic eligibility, cứ gọi lại sau bất kỳ mutation nào là an toàn.
   */
  async syncSearchIndex(postId: number): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        languageId: true,
        status: true,
        deletedAt: true,
        title: true,
        content: true,
        updatedAt: true,
        language: {
          select: {
            isActive: true,
            deletedAt: true,
          },
        },
        author: {
          select: {
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!post) {
      await this.removeFromIndex(postId);
      return;
    }

    if (!this.isEligibleForIndex(post)) {
      await this.removeFromIndex(postId);
      return;
    }

    /**
     * titleText/contentText là nguồn cho cột generated
     * search_vector (setweight title=A, content=B) — xem migration
     * add_search_documents. Không set searchVector ở đây vì Prisma
     * coi nó là Unsupported("tsvector"), Postgres tự tính lại.
     */
    await this.prisma.searchDocument.upsert({
      where: { postId: post.id },
      create: {
        postId: post.id,
        languageId: post.languageId,
        status: post.status,
        titleText: post.title,
        contentText: post.content,
        sourceUpdatedAt: post.updatedAt,
      },
      update: {
        languageId: post.languageId,
        status: post.status,
        titleText: post.title,
        contentText: post.content,
        sourceUpdatedAt: post.updatedAt,
        indexedAt: new Date(),
      },
    });
  }

  /**
   * Đồng bộ cả GROUP (root + mọi bản dịch) từ một postId bất kỳ
   * trong group đó. Dùng khi một hành động (approve, reject, xoá...)
   * ảnh hưởng đồng thời nhiều phiên bản ngôn ngữ.
   */
  async syncSearchIndexGroup(anyPostIdInGroup: number): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: anyPostIdInGroup },
      select: { id: true, parentPostId: true },
    });

    if (!post) {
      await this.removeFromIndex(anyPostIdInGroup);
      return;
    }

    const rootId = post.parentPostId ?? post.id;

    const groupPosts = await this.prisma.post.findMany({
      where: {
        OR: [
          { id: rootId, parentPostId: null },
          { parentPostId: rootId },
        ],
      },
      select: { id: true },
    });

    for (const groupPost of groupPosts) {
      try {
        await this.syncSearchIndex(groupPost.id);
      } catch (error) {
        this.logger.error(
          `Đồng bộ search index thất bại cho post ${groupPost.id}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  async removeFromIndex(postId: number): Promise<void> {
    await this.prisma.searchDocument.deleteMany({
      where: { postId },
    });
  }

  isEligibleForIndex(post: SearchEligibilityCheck): boolean {
    return (
      post.status === PostStatus.PUBLISH &&
      post.deletedAt === null &&
      post.language !== null &&
      post.language.isActive &&
      post.language.deletedAt === null &&
      post.author !== null &&
      post.author.status === UserStatus.ACTIVE &&
      post.author.deletedAt === null
    );
  }
}
