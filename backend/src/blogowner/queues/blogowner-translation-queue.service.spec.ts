import { FlowProducer } from 'bullmq';

import {
  BLOGOWNER_TRANSLATION_JOB,
  BLOGOWNER_TRANSLATION_QUEUE,
} from './blogowner-translation.constants';

import { BlogownerTranslationQueueService } from './blogowner-translation-queue.service';

describe('BlogownerTranslationQueueService', () => {
  let service: BlogownerTranslationQueueService;

  const mockFlowProducer = {
    add: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new BlogownerTranslationQueueService(
      mockFlowProducer as unknown as FlowProducer,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should enqueue a translation flow with one parent and unique child jobs', async () => {
    mockFlowProducer.add.mockResolvedValue({
      job: {
        id: 'parent-job',
      },
    });

    const result = await service.enqueueBatch({
      rootPostId: 100,
      ownerId: 3,

      sourceLanguageId: 4,

      sourceUpdatedAt:
        '2026-09-10T02:00:00.000Z',

      /**
       * 5 bị duplicate để kiểm tra service normalize.
       */
      targetLanguageIds: [5, 6, 5],

      submitForReview: true,
    });

    expect(
      mockFlowProducer.add,
    ).toHaveBeenCalledTimes(1);

    const flow =
      mockFlowProducer.add.mock.calls[0][0];

    /**
     * Parent = FINALIZE.
     */
    expect(flow.name).toBe(
      BLOGOWNER_TRANSLATION_JOB.FINALIZE_BATCH,
    );

    expect(flow.queueName).toBe(
      BLOGOWNER_TRANSLATION_QUEUE,
    );

    expect(flow.data).toEqual({
    rootPostId: 100,
    ownerId: 3,

    sourceUpdatedAt:
        '2026-09-10T02:00:00.000Z',

    submitForReview: true,

    targetLanguageIds: [5, 6],
    });

    expect(flow.opts).toEqual(
      expect.objectContaining({
        jobId: expect.stringMatching(
          /^translation-batch-100-/,
        ),

        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      }),
    );

    /**
     * Duplicate language phải bị loại.
     *
     * [5,6,5] -> [5,6]
     */
    expect(flow.children).toHaveLength(2);

    expect(
      flow.children.map(
        (child: {
          data: {
            targetLanguageId: number;
          };
        }) => child.data.targetLanguageId,
      ),
    ).toEqual([5, 6]);

    for (const child of flow.children) {
      expect(child.name).toBe(
        BLOGOWNER_TRANSLATION_JOB.TRANSLATE_POST,
      );

      expect(child.queueName).toBe(
        BLOGOWNER_TRANSLATION_QUEUE,
      );

      expect(child.data).toEqual(
        expect.objectContaining({
          rootPostId: 100,
          ownerId: 3,

          sourceLanguageId: 4,

          sourceUpdatedAt:
            '2026-09-10T02:00:00.000Z',
        }),
      );

      expect(child.opts).toEqual(
        expect.objectContaining({
          attempts: 3,

          backoff: {
            type: 'exponential',
            delay: 3000,
          },

          failParentOnFailure: true,
        }),
      );
    }

    expect(result).toEqual({
      batchId: expect.stringMatching(
        /^translation-batch-100-/,
      ),

      targetLanguageIds: [5, 6],
    });

    /**
     * batchId trả về phải đúng với parent jobId.
     */
    expect(result.batchId).toBe(
      flow.opts.jobId,
    );
  });

  it('should enqueue draft finalization when submitForReview is false', async () => {
    mockFlowProducer.add.mockResolvedValue({});

    await service.enqueueBatch({
      rootPostId: 200,
      ownerId: 7,

      sourceLanguageId: 4,

      sourceUpdatedAt:
        '2026-09-10T03:00:00.000Z',

      targetLanguageIds: [5],

      submitForReview: false,
    });

    const flow =
      mockFlowProducer.add.mock.calls[0][0];

    expect(flow.data).toEqual(
      expect.objectContaining({
        rootPostId: 200,
        ownerId: 7,
        submitForReview: false,
      }),
    );
  });

  it('should reject an empty translation batch', async () => {
    await expect(
      service.enqueueBatch({
        rootPostId: 100,
        ownerId: 3,

        sourceLanguageId: 4,

        sourceUpdatedAt:
          '2026-09-10T02:00:00.000Z',

        targetLanguageIds: [],

        submitForReview: true,
      }),
    ).rejects.toThrow(
      'Translation batch phải có ít nhất một ngôn ngữ đích.',
    );

    expect(
      mockFlowProducer.add,
    ).not.toHaveBeenCalled();
  });
});