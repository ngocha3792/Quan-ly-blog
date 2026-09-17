import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  PrismaModule,
  PrismaService,
} from '@app/core';

import { BlogownerApiModule } from './blogowner-api.module';

import { BlogownerDashboardController } from './controllers/blogowner-dashboard.controller';
import { BlogownerMediaController } from './controllers/blogowner-media.controller';
import { BlogownerOptionsController } from './controllers/blogowner-options.controller';
import { BlogownerPostsController } from './controllers/blogowner-posts.controller';
import { BlogownerTranslationController } from './controllers/blogowner-translation.controller';

import {
  BLOGOWNER_TRANSLATION_QUEUE_SERVICE,
  BlogownerTranslationQueueModule,
  BlogownerTranslationStatusService,
} from './queues';

import { BlogownerDashboardService } from './services/blogowner-dashboard.service';
import { BlogownerMediaService } from './services/blogowner-media.service';
import { BlogownerOptionsService } from './services/blogowner-options.service';
import { BlogownerPostHelperService } from './services/blogowner-post-helper.service';
import { BlogownerPostsService } from './services/blogowner-posts.service';

/**
 * Module giả dành riêng cho BlogownerApiModule spec.
 *
 * Không import BullMQ/Redis thật:
 * - tránh unit/module test phụ thuộc Redis local;
 * - tránh ECONNREFUSED khi Redis chưa chạy;
 * - tránh BullMQ giữ open handle làm Jest không thoát;
 * - vẫn giữ đúng dependency contract mà BlogownerApiModule cần.
 */
@Module({
  providers: [
    {
      provide:
        BLOGOWNER_TRANSLATION_QUEUE_SERVICE,
      useValue: {
        enqueueBatch: jest.fn(),
      },
    },

    {
      provide:
        BlogownerTranslationStatusService,
      useValue: {
        getBatchStatus: jest.fn(),
      },
    },
  ],

  exports: [
    BLOGOWNER_TRANSLATION_QUEUE_SERVICE,
    BlogownerTranslationStatusService,
  ],
})
class MockBlogownerTranslationQueueModule {}

describe('BlogownerApiModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module =
      await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
          }),

          PrismaModule,
          BlogownerApiModule,
        ],
      })
        /**
         * BlogownerApiModule production vẫn import
         * BlogownerTranslationQueueModule thật.
         *
         * Riêng test module thì thay bằng mock để test
         * dependency graph mà không mở kết nối Redis.
         */
        .overrideModule(
          BlogownerTranslationQueueModule,
        )
        .useModule(
          MockBlogownerTranslationQueueModule,
        )

        .overrideProvider(PrismaService)
        .useValue({
          post: {},
          media: {},
          user: {},
          language: {},
          category: {},
          tag: {},

          $transaction: jest.fn(),
        })

        .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();

    expect(
      module.get(BlogownerApiModule),
    ).toBeDefined();
  });

  it('should resolve all controllers', () => {
    expect(
      module.get(BlogownerPostsController),
    ).toBeDefined();

    expect(
      module.get(BlogownerOptionsController),
    ).toBeDefined();

    expect(
      module.get(
        BlogownerDashboardController,
      ),
    ).toBeDefined();

    expect(
      module.get(BlogownerMediaController),
    ).toBeDefined();

    expect(
      module.get(
        BlogownerTranslationController,
      ),
    ).toBeDefined();
  });

  it('should resolve all services', () => {
    expect(
      module.get(
        BlogownerPostHelperService,
      ),
    ).toBeDefined();

    expect(
      module.get(BlogownerPostsService),
    ).toBeDefined();

    expect(
      module.get(BlogownerOptionsService),
    ).toBeDefined();

    expect(
      module.get(
        BlogownerDashboardService,
      ),
    ).toBeDefined();

    expect(
      module.get(BlogownerMediaService),
    ).toBeDefined();

    expect(
      module.get(
        BlogownerTranslationStatusService,
      ),
    ).toBeDefined();
  });
});