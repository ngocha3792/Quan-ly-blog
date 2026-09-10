import type {
  AuthenticatedUser,
} from '@app/core';

import { BlogownerTranslationController } from './blogowner-translation.controller';
import { BlogownerTranslationStatusService } from '../queues/blogowner-translation-status.service';

describe(
  'BlogownerTranslationController',
  () => {
    let controller:
      BlogownerTranslationController;

    const mockTranslationStatusService = {
      getBatchStatus: jest.fn(),
    };

    beforeEach(() => {
      jest.resetAllMocks();

      controller =
        new BlogownerTranslationController(
          mockTranslationStatusService as unknown as BlogownerTranslationStatusService,
        );
    });

    it('should be defined', () => {
      expect(
        controller,
      ).toBeDefined();
    });

    it('should return translation batch status for current owner', async () => {
      const response = {
        batchId: 'batch-100',

        rootPostId: 100,

        status:
          'PROCESSING' as const,

        progress: 45,

        translations: [
          {
            languageId: 5,

            status:
              'PROCESSING' as const,

            progress: 50,
          },
        ],
      };

      mockTranslationStatusService
        .getBatchStatus
        .mockResolvedValue(response);

      const user = {
        id: 3,
      } as AuthenticatedUser;

      const result =
        await controller.getBatchStatus(
          user,
          'batch-100',
        );

      expect(
        mockTranslationStatusService
          .getBatchStatus,
      ).toHaveBeenCalledWith(
        3,
        'batch-100',
      );

      expect(result).toEqual(
        response,
      );
    });
  },
);