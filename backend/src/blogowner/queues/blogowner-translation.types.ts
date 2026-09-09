export interface TranslatePostJobData {
  rootPostId: number;
  ownerId: number;

  sourceLanguageId: number;
  targetLanguageId: number;

  sourceUpdatedAt: string;
}

export interface FinalizeTranslationBatchJobData {
  rootPostId: number;
  ownerId: number;

  sourceUpdatedAt: string;

  submitForReview: boolean;
}

export interface EnqueueTranslationBatchInput {
  rootPostId: number;
  ownerId: number;

  sourceLanguageId: number;
  sourceUpdatedAt: string;

  targetLanguageIds: number[];

  submitForReview: boolean;
}

export interface EnqueueTranslationBatchResult {
  batchId: string;
  targetLanguageIds: number[];
}

/**
 * Port mà business service sử dụng.
 *
 * BlogownerPostsService chỉ biết rằng có một service
 * có khả năng enqueue translation batch.
 *
 * Nó không cần biết BullMQ, Redis hay FlowProducer.
 */
export interface BlogownerTranslationQueuePort {
  enqueueBatch(
    input: EnqueueTranslationBatchInput,
  ): Promise<EnqueueTranslationBatchResult>;
}