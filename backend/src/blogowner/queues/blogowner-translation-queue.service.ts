import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectFlowProducer } from '@nestjs/bullmq';

import { FlowProducer } from 'bullmq';

import {
  BLOGOWNER_TRANSLATION_FLOW,
  BLOGOWNER_TRANSLATION_JOB,
  BLOGOWNER_TRANSLATION_QUEUE,
} from './blogowner-translation.constants';

import {
  BlogownerTranslationQueuePort,
  EnqueueTranslationBatchInput,
  EnqueueTranslationBatchResult,
  FinalizeTranslationBatchJobData,
  TranslatePostJobData,
} from './blogowner-translation.types';
@Injectable()
export class BlogownerTranslationQueueService 
  implements BlogownerTranslationQueuePort {
  constructor(
    @InjectFlowProducer(BLOGOWNER_TRANSLATION_FLOW)
    private readonly flowProducer: FlowProducer,
  ) {}

  async enqueueBatch(
    input: EnqueueTranslationBatchInput,
  ): Promise<EnqueueTranslationBatchResult> {
    const targetLanguageIds = Array.from(
      new Set(input.targetLanguageIds),
    );

    if (targetLanguageIds.length === 0) {
      throw new Error(
        'Translation batch phải có ít nhất một ngôn ngữ đích.',
      );
    }

    const batchId =
      `translation-batch-${input.rootPostId}-${randomUUID()}`;

    const finalizeData: FinalizeTranslationBatchJobData = {
      rootPostId: input.rootPostId,
      ownerId: input.ownerId,
      sourceUpdatedAt: input.sourceUpdatedAt,
      submitForReview: input.submitForReview,
    };

    await this.flowProducer.add({
      name: BLOGOWNER_TRANSLATION_JOB.FINALIZE_BATCH,

      queueName: BLOGOWNER_TRANSLATION_QUEUE,

      data: finalizeData,

      opts: {
        jobId: batchId,

        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 3000,
        },

        removeOnComplete: {
          age: 60 * 60,
          count: 1000,
        },

        removeOnFail: {
          age: 24 * 60 * 60,
          count: 1000,
        },
      },

      children: targetLanguageIds.map(
        (targetLanguageId) => {
          const data: TranslatePostJobData = {
            rootPostId: input.rootPostId,
            ownerId: input.ownerId,

            sourceLanguageId:
              input.sourceLanguageId,

            targetLanguageId,

            sourceUpdatedAt:
              input.sourceUpdatedAt,
          };

          return {
            name: BLOGOWNER_TRANSLATION_JOB.TRANSLATE_POST,

            queueName: BLOGOWNER_TRANSLATION_QUEUE,

            data,

            opts: {
              jobId:
                `translate-${batchId}-${targetLanguageId}`,

              attempts: 3,

              backoff: {
                type: 'exponential',
                delay: 3000,
              },

              /**
               * Sau khi child đã retry hết mà vẫn fail,
               * parent finalize cũng phải fail.
               *
               * => group không được chuyển
               * PENDING_REVIEW.
               */
              failParentOnFailure: true,

              removeOnComplete: {
                age: 60 * 60,
                count: 1000,
              },

              removeOnFail: {
                age: 24 * 60 * 60,
                count: 1000,
              },
            },
          };
        },
      ),
    });

    return {
      batchId,
      targetLanguageIds,
    };
  }
}