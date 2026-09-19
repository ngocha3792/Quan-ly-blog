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

  /**
   * Còn job dịch (translate hoặc finalize) nào của rootPostId này
   * chưa xong (waiting/active/delayed/waiting-children) không.
   *
   * Dùng để chặn submitForReview() thủ công trong lúc batch dịch
   * nền còn chạy — nếu không chặn, root.updatedAt bị đổi giữa chừng
   * khiến job dịch còn dang dở ghi đè trạng thái DRAFT lên một group
   * đã PENDING_REVIEW, tạo group kẹt vĩnh viễn (Moderator không
   * duyệt được vì group lệch trạng thái, Blog Owner không sửa được
   * vì root đang PENDING_REVIEW).
   */
  hasActiveBatch(rootPostId: number): Promise<boolean>;
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