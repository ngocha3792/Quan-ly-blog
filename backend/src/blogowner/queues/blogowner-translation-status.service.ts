import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';

import {
  Job,
  Queue,
} from 'bullmq';

import {
  BLOGOWNER_TRANSLATION_QUEUE,
} from './blogowner-translation.constants';

import type {
  BlogownerTranslationBatchStatus,
  FinalizeTranslationBatchJobData,
  TranslationBatchStatusResult,
  TranslationLanguageJobStatus,
} from './blogowner-translation.types';

@Injectable()
export class BlogownerTranslationStatusService {
  constructor(
    @InjectQueue(BLOGOWNER_TRANSLATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async getBatchStatus(
    ownerId: number,
    batchId: string,
  ): Promise<TranslationBatchStatusResult> {
    const parent =
      (await this.queue.getJob(
        batchId,
      )) as
        | Job<FinalizeTranslationBatchJobData>
        | undefined;

    if (
      !parent ||
      parent.data.ownerId !== ownerId
    ) {
      /**
       * Cùng trả 404 cho:
       * - batch không tồn tại;
       * - batch thuộc owner khác.
       *
       * Không làm lộ batch của user khác.
       */
      throw new NotFoundException(
        'Không tìm thấy translation batch.',
      );
    }

    const targetLanguageIds =
      parent.data.targetLanguageIds ?? [];

    const translations =
      await Promise.all(
        targetLanguageIds.map(
          async (
            languageId,
          ): Promise<TranslationLanguageJobStatus> => {
            const childId =
              `translate-${batchId}-${languageId}`;

            const child =
              await this.queue.getJob(
                childId,
              );

            if (!child) {
              return {
                languageId,
                status: 'QUEUED',
                progress: 0,
              };
            }

            const childState =
              await child.getState();

            const status =
              this.mapJobState(
                childState,
              );

            return {
              languageId,

              status,

              progress:
                this.normalizeProgress(
                  child.progress,
                  status,
                ),
            };
          },
        ),
      );

    const parentState =
      await parent.getState();

    let status =
      this.mapJobState(
        parentState,
      );

    /**
     * waiting-children của parent tự nó chỉ là trạng thái chờ.
     * Ta nhìn thêm trạng thái các child để biểu diễn đúng
     * tiến trình của cả batch.
     */
    if (
      status !== 'COMPLETED' &&
      status !== 'FAILED'
    ) {
      if (
        translations.some(
          (translation) =>
            translation.status ===
            'FAILED',
        )
      ) {
        status = 'FAILED';
      } else if (
        translations.some(
          (translation) =>
            translation.status ===
              'PROCESSING' ||
            translation.status ===
              'COMPLETED',
        )
      ) {
        status = 'PROCESSING';
      } else {
        status = 'QUEUED';
      }
    }

    const progress =
      this.calculateBatchProgress(
        status,
        translations,
      );

    return {
      batchId,

      rootPostId:
        parent.data.rootPostId,

      status,

      progress,

      translations,
    };
  }

  private mapJobState(
    state: string,
  ): BlogownerTranslationBatchStatus {
    switch (state) {
      case 'completed':
        return 'COMPLETED';

      case 'failed':
        return 'FAILED';

      case 'active':
        return 'PROCESSING';

      default:
        /**
         * waiting
         * delayed
         * waiting-children
         * prioritized
         */
        return 'QUEUED';
    }
  }

  private normalizeProgress(
    progress: unknown,
    status: BlogownerTranslationBatchStatus,
  ): number {
    if (status === 'COMPLETED') {
      return 100;
    }

    if (
      typeof progress !== 'number' ||
      !Number.isFinite(progress)
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(progress),
      ),
    );
  }

  private calculateBatchProgress(
    status: BlogownerTranslationBatchStatus,
    translations: TranslationLanguageJobStatus[],
  ): number {
    if (status === 'COMPLETED') {
      return 100;
    }

    if (
      translations.length === 0
    ) {
      return 0;
    }

    const average =
      translations.reduce(
        (sum, translation) =>
          sum +
          translation.progress,
        0,
      ) / translations.length;

    /**
     * Child translations chiếm 90%.
     * 10% cuối dành cho FINALIZE.
     */
    return Math.min(
      90,
      Math.round(
        average * 0.9,
      ),
    );
  }
}