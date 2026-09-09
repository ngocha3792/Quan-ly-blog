import { NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';

import { BlogownerTranslationStatusService } from './blogowner-translation-status.service';

describe('BlogownerTranslationStatusService', () => {
  let service: BlogownerTranslationStatusService;

  const mockQueue = {
    getJob: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new BlogownerTranslationStatusService(
      mockQueue as unknown as Queue,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return QUEUED when all translation jobs are waiting', async () => {
    const parent = {
      data: {
        rootPostId: 100,
        ownerId: 3,
        sourceUpdatedAt:
          '2026-09-10T02:00:00.000Z',
        submitForReview: true,
        targetLanguageIds: [5, 6],
      },

      getState: jest
        .fn()
        .mockResolvedValue('waiting-children'),
    };

    const child5 = {
      progress: 0,
      getState: jest
        .fn()
        .mockResolvedValue('waiting'),
    };

    const child6 = {
      progress: 0,
      getState: jest
        .fn()
        .mockResolvedValue('waiting'),
    };

    mockQueue.getJob.mockImplementation(
      async (jobId: string) => {
        if (jobId === 'batch-100') {
          return parent;
        }

        if (
          jobId ===
          'translate-batch-100-5'
        ) {
          return child5;
        }

        if (
          jobId ===
          'translate-batch-100-6'
        ) {
          return child6;
        }

        return undefined;
      },
    );

    const result =
      await service.getBatchStatus(
        3,
        'batch-100',
      );

    expect(result).toEqual({
      batchId: 'batch-100',
      rootPostId: 100,

      status: 'QUEUED',
      progress: 0,

      translations: [
        {
          languageId: 5,
          status: 'QUEUED',
          progress: 0,
        },
        {
          languageId: 6,
          status: 'QUEUED',
          progress: 0,
        },
      ],
    });
  });

  it('should return PROCESSING and calculate progress from child jobs', async () => {
    const parent = {
      data: {
        rootPostId: 100,
        ownerId: 3,
        sourceUpdatedAt:
          '2026-09-10T02:00:00.000Z',
        submitForReview: true,
        targetLanguageIds: [5, 6],
      },

      getState: jest
        .fn()
        .mockResolvedValue('waiting-children'),
    };

    const child5 = {
      progress: 40,

      getState: jest
        .fn()
        .mockResolvedValue('active'),
    };

    const child6 = {
      progress: 100,

      getState: jest
        .fn()
        .mockResolvedValue('completed'),
    };

    mockQueue.getJob.mockImplementation(
      async (jobId: string) => {
        if (jobId === 'batch-100') {
          return parent;
        }

        if (
          jobId ===
          'translate-batch-100-5'
        ) {
          return child5;
        }

        if (
          jobId ===
          'translate-batch-100-6'
        ) {
          return child6;
        }

        return undefined;
      },
    );

    const result =
      await service.getBatchStatus(
        3,
        'batch-100',
      );

    /**
     * Average child progress:
     * (40 + 100) / 2 = 70
     *
     * Translation chiếm 90%:
     * 70 * 0.9 = 63
     */
    expect(result).toEqual({
      batchId: 'batch-100',
      rootPostId: 100,

      status: 'PROCESSING',
      progress: 63,

      translations: [
        {
          languageId: 5,
          status: 'PROCESSING',
          progress: 40,
        },
        {
          languageId: 6,
          status: 'COMPLETED',
          progress: 100,
        },
      ],
    });
  });

  it('should return COMPLETED with 100 percent progress when parent is completed', async () => {
    const parent = {
      data: {
        rootPostId: 100,
        ownerId: 3,
        sourceUpdatedAt:
          '2026-09-10T02:00:00.000Z',
        submitForReview: true,
        targetLanguageIds: [5],
      },

      getState: jest
        .fn()
        .mockResolvedValue('completed'),
    };

    const child = {
      progress: 100,

      getState: jest
        .fn()
        .mockResolvedValue('completed'),
    };

    mockQueue.getJob.mockImplementation(
      async (jobId: string) => {
        if (jobId === 'batch-100') {
          return parent;
        }

        if (
          jobId ===
          'translate-batch-100-5'
        ) {
          return child;
        }

        return undefined;
      },
    );

    const result =
      await service.getBatchStatus(
        3,
        'batch-100',
      );

    expect(result).toEqual({
      batchId: 'batch-100',
      rootPostId: 100,

      status: 'COMPLETED',
      progress: 100,

      translations: [
        {
          languageId: 5,
          status: 'COMPLETED',
          progress: 100,
        },
      ],
    });
  });

  it('should return FAILED when one translation job fails', async () => {
    const parent = {
      data: {
        rootPostId: 100,
        ownerId: 3,
        sourceUpdatedAt:
          '2026-09-10T02:00:00.000Z',
        submitForReview: true,
        targetLanguageIds: [5, 6],
      },

      getState: jest
        .fn()
        .mockResolvedValue('waiting-children'),
    };

    const child5 = {
      progress: 100,

      getState: jest
        .fn()
        .mockResolvedValue('completed'),
    };

    const child6 = {
      progress: 40,

      getState: jest
        .fn()
        .mockResolvedValue('failed'),
    };

    mockQueue.getJob.mockImplementation(
      async (jobId: string) => {
        if (jobId === 'batch-100') {
          return parent;
        }

        if (
          jobId ===
          'translate-batch-100-5'
        ) {
          return child5;
        }

        if (
          jobId ===
          'translate-batch-100-6'
        ) {
          return child6;
        }

        return undefined;
      },
    );

    const result =
      await service.getBatchStatus(
        3,
        'batch-100',
      );

    expect(result.status).toBe(
      'FAILED',
    );

    expect(
      result.translations,
    ).toEqual([
      {
        languageId: 5,
        status: 'COMPLETED',
        progress: 100,
      },
      {
        languageId: 6,
        status: 'FAILED',
        progress: 40,
      },
    ]);
  });

  it('should treat a missing child job as QUEUED', async () => {
    const parent = {
      data: {
        rootPostId: 100,
        ownerId: 3,
        sourceUpdatedAt:
          '2026-09-10T02:00:00.000Z',
        submitForReview: false,
        targetLanguageIds: [5],
      },

      getState: jest
        .fn()
        .mockResolvedValue('waiting-children'),
    };

    mockQueue.getJob.mockImplementation(
      async (jobId: string) => {
        if (jobId === 'batch-100') {
          return parent;
        }

        return undefined;
      },
    );

    const result =
      await service.getBatchStatus(
        3,
        'batch-100',
      );

    expect(result).toEqual({
      batchId: 'batch-100',
      rootPostId: 100,

      status: 'QUEUED',
      progress: 0,

      translations: [
        {
          languageId: 5,
          status: 'QUEUED',
          progress: 0,
        },
      ],
    });
  });

  it('should return not found when batch does not exist', async () => {
    mockQueue.getJob.mockResolvedValue(
      undefined,
    );

    await expect(
      service.getBatchStatus(
        3,
        'unknown-batch',
      ),
    ).rejects.toThrow(
      new NotFoundException(
        'Không tìm thấy translation batch.',
      ),
    );
  });

  it('should not expose a batch owned by another user', async () => {
    mockQueue.getJob.mockResolvedValue({
      data: {
        rootPostId: 100,

        /**
         * Batch thuộc owner khác.
         */
        ownerId: 99,

        targetLanguageIds: [5],
      },

      getState: jest.fn(),
    });

    await expect(
      service.getBatchStatus(
        3,
        'batch-100',
      ),
    ).rejects.toThrow(
      new NotFoundException(
        'Không tìm thấy translation batch.',
      ),
    );
  });
});