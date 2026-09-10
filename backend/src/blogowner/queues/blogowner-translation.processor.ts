import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import {
  Job,
  UnrecoverableError,
} from 'bullmq';

import { PostStatus } from '@prisma/client';

import {
  LibreTranslateService,
  PrismaService,
} from '@app/core';

import {
  BLOGOWNER_TRANSLATION_JOB,
  BLOGOWNER_TRANSLATION_QUEUE,
} from './blogowner-translation.constants';

import {
  FinalizeTranslationBatchJobData,
  TranslatePostJobData,
} from './blogowner-translation.types';

@Processor(BLOGOWNER_TRANSLATION_QUEUE, {
  concurrency: 2,
})
export class BlogownerTranslationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly libreTranslateService: LibreTranslateService,
  ) {
    super();
  }

  async process(
    job: Job<
      TranslatePostJobData |
        FinalizeTranslationBatchJobData,
      unknown,
      string
    >,
  ): Promise<unknown> {
    switch (job.name) {
      case BLOGOWNER_TRANSLATION_JOB.TRANSLATE_POST:
        return this.processTranslation(
          job as Job<TranslatePostJobData>,
        );

      case BLOGOWNER_TRANSLATION_JOB.FINALIZE_BATCH:
        return this.finalizeBatch(
          job as Job<FinalizeTranslationBatchJobData>,
        );

      default:
        throw new UnrecoverableError(
          `Không hỗ trợ translation job: ${job.name}`,
        );
    }
  }

  private async processTranslation(
    job: Job<TranslatePostJobData>,
  ) {
    const {
      rootPostId,
      ownerId,
      sourceLanguageId,
      targetLanguageId,
      sourceUpdatedAt,
    } = job.data;

    await job.updateProgress(10);

    /**
     * Luôn dịch từ ROOT thật sự.
     */
    const root = await this.prisma.post.findFirst({
      where: {
        id: rootPostId,
        authorId: ownerId,

        parentPostId: null,
        deletedAt: null,
      },

      include: {
        language: {
          select: {
            id: true,
            code: true,
          },
        },

        postCategories: {
          where: {
            category: {
              deletedAt: null,

              categoryGroup: {
                deletedAt: null,
              },
            },
          },

          select: {
            category: {
              select: {
                categoryGroupId: true,
              },
            },
          },
        },

        postTags: {
          where: {
            tag: {
              deletedAt: null,
            },
          },

          select: {
            tagId: true,
          },
        },
      },
    });

    if (!root) {
      throw new UnrecoverableError(
        `Không tìm thấy bài gốc ID ${rootPostId}.`,
      );
    }

    /**
     * Job cũ không được phép ghi đè bài mới.
     *
     * Ví dụ:
     * batch A enqueue
     * Owner sửa bài
     * batch B enqueue
     * batch A chạy trễ
     *
     * => batch A phải dừng.
     */
    if (
      root.languageId !== sourceLanguageId ||
      root.updatedAt.toISOString() !== sourceUpdatedAt
    ) {
      throw new UnrecoverableError(
        'Bài gốc đã thay đổi sau khi translation job được tạo.',
      );
    }

    if (targetLanguageId === root.languageId) {
      throw new UnrecoverableError(
        'Ngôn ngữ đích không được trùng ngôn ngữ nguồn.',
      );
    }

    const targetLanguage =
      await this.prisma.language.findFirst({
        where: {
          id: targetLanguageId,
          deletedAt: null,
        },

        select: {
          id: true,
          code: true,
        },
      });

    if (!targetLanguage) {
      throw new UnrecoverableError(
        `Ngôn ngữ ID ${targetLanguageId} không tồn tại hoặc đã bị vô hiệu hóa.`,
      );
    }

    await job.updateProgress(25);

    /**
     * Category KHÔNG dịch lại bằng LibreTranslate.
     *
     * Chỉ ánh xạ cùng CategoryGroup
     * sang ngôn ngữ đích.
     */
    const categoryGroupIds = Array.from(
      new Set(
        root.postCategories.map(
          (postCategory) =>
            postCategory.category.categoryGroupId,
        ),
      ),
    );

    const translatedCategories =
      categoryGroupIds.length > 0
        ? await this.prisma.category.findMany({
            where: {
              categoryGroupId: {
                in: categoryGroupIds,
              },

              languageId: targetLanguageId,

              deletedAt: null,

              categoryGroup: {
                deletedAt: null,
              },
            },

            select: {
              id: true,
              categoryGroupId: true,
            },
          })
        : [];

    const translatedCategoryGroupIds = new Set(
      translatedCategories.map(
        (category) => category.categoryGroupId,
      ),
    );

    if (
      translatedCategoryGroupIds.size !==
      categoryGroupIds.length
    ) {
      throw new UnrecoverableError(
        'Một hoặc nhiều danh mục chưa có bản dịch trong ngôn ngữ được chọn.',
      );
    }

    await job.updateProgress(40);

    /**
     * Dịch title + content qua shared
     * LibreTranslateService.
     *
     * Lỗi kết nối LibreTranslate sẽ throw bình thường
     * => BullMQ retry theo attempts/backoff.
     */
    const translated =
      await this.libreTranslateService.translateTexts({
        texts: [
          root.title,
          root.content,
        ],

        sourceLanguageCode: root.language.code,
        targetLanguageCode: targetLanguage.code,

        format: 'html',
      });

    const [translatedTitle, translatedContent] =
      translated;

    await job.updateProgress(75);

    const sourceTagIds = root.postTags.map(
      (postTag) => postTag.tagId,
    );

    /**
     * UPSERT giúp worker idempotent.
     *
     * Nếu worker bị restart sau khi DB đã ghi xong
     * nhưng BullMQ chưa ACK job:
     *
     * retry sẽ UPDATE record cũ,
     * không tạo duplicate translation.
     */
    const translationPost =
      await this.prisma.post.upsert({
        where: {
          parentPostId_languageId: {
            parentPostId: root.id,
            languageId: targetLanguageId,
          },
        },

        update: {
          title: translatedTitle,
          content: translatedContent,

          thumbnailUrl: root.thumbnailUrl,

          status: PostStatus.DRAFT,

          deletedAt: null,
          publishedAt: null,

          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,

          postCategories: {
            deleteMany: {},

            create: translatedCategories.map(
              (category) => ({
                categoryId: category.id,
              }),
            ),
          },

          postTags: {
            deleteMany: {},

            create: sourceTagIds.map((tagId) => ({
              tagId,
            })),
          },
        },

        create: {
          title: translatedTitle,
          content: translatedContent,

          thumbnailUrl: root.thumbnailUrl,

          status: PostStatus.DRAFT,

          authorId: ownerId,

          parentPostId: root.id,
          languageId: targetLanguageId,

          postCategories: {
            create: translatedCategories.map(
              (category) => ({
                categoryId: category.id,
              }),
            ),
          },

          postTags: {
            create: sourceTagIds.map((tagId) => ({
              tagId,
            })),
          },
        },

        select: {
          id: true,
          languageId: true,
        },
      });

    await job.updateProgress(100);

    return {
      postId: translationPost.id,
      languageId: translationPost.languageId,
    };
  }

  private async finalizeBatch(
    job: Job<FinalizeTranslationBatchJobData>,
  ) {
    const {
      rootPostId,
      ownerId,
      sourceUpdatedAt,
      submitForReview,
    } = job.data;

    await job.updateProgress(20);

    const root = await this.prisma.post.findFirst({
      where: {
        id: rootPostId,
        authorId: ownerId,

        parentPostId: null,
        deletedAt: null,
      },

      select: {
        id: true,
        updatedAt: true,
      },
    });

    if (!root) {
      throw new UnrecoverableError(
        `Không tìm thấy bài gốc ID ${rootPostId}.`,
      );
    }

    /**
     * Không cho parent của batch cũ finalize
     * sau khi Owner đã sửa root.
     */
    if (
      root.updatedAt.toISOString() !== sourceUpdatedAt
    ) {
      throw new UnrecoverableError(
        'Không thể finalize vì bài gốc đã được cập nhật bởi một batch mới hơn.',
      );
    }

    await job.updateProgress(60);

    const finalStatus = submitForReview
      ? PostStatus.PENDING_REVIEW
      : PostStatus.DRAFT;

    /**
     * Parent chỉ chạy sau khi tất cả child
     * translation đã thành công.
     */
    await this.prisma.post.updateMany({
      where: {
        authorId: ownerId,
        deletedAt: null,

        OR: [
          {
            id: rootPostId,
            parentPostId: null,
          },
          {
            parentPostId: rootPostId,
          },
        ],
      },

      data: {
        status: finalStatus,

        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    });

    await job.updateProgress(100);

    return {
      rootPostId,
      status: finalStatus,
    };
  }
}