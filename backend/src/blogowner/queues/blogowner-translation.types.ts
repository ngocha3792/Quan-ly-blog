export type BlogownerTranslationBatchStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

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

  /**
   * Parent giữ danh sách target languages để API progress
   * không cần scan toàn bộ Redis.
   */
  targetLanguageIds: number[];
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

export interface BlogownerTranslationQueuePort {
  enqueueBatch(
    input: EnqueueTranslationBatchInput,
  ): Promise<EnqueueTranslationBatchResult>;
}

export interface TranslationLanguageJobStatus {
  languageId: number;

  status: BlogownerTranslationBatchStatus;

  progress: number;
}

export interface TranslationBatchStatusResult {
  batchId: string;

  rootPostId: number;

  status: BlogownerTranslationBatchStatus;

  progress: number;

  translations: TranslationLanguageJobStatus[];
}