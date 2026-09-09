import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import {
  PrismaModule,
  TranslationModule,
} from '@app/core';

import {
  BLOGOWNER_TRANSLATION_FLOW,
  BLOGOWNER_TRANSLATION_QUEUE,
  BLOGOWNER_TRANSLATION_QUEUE_SERVICE,
} from './blogowner-translation.constants';

import { BlogownerTranslationQueueService } from './blogowner-translation-queue.service';
import { BlogownerTranslationProcessor } from './blogowner-translation.processor';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    TranslationModule,

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        connection: {
          host:
            configService.get<string>('REDIS_HOST') ??
            '127.0.0.1',

          port: Number(
            configService.get<string>('REDIS_PORT') ??
              '6379',
          ),

          username:
            configService.get<string>('REDIS_USERNAME') ||
            undefined,

          password:
            configService.get<string>('REDIS_PASSWORD') ||
            undefined,

          maxRetriesPerRequest: null,
        },
      }),
    }),

    BullModule.registerQueue({
      name: BLOGOWNER_TRANSLATION_QUEUE,
    }),

    BullModule.registerFlowProducer({
      name: BLOGOWNER_TRANSLATION_FLOW,
    }),
  ],

  providers: [
    BlogownerTranslationQueueService,
    BlogownerTranslationProcessor,

    {
      provide: BLOGOWNER_TRANSLATION_QUEUE_SERVICE,
      useExisting: BlogownerTranslationQueueService,
    },
  ],

  exports: [
    BLOGOWNER_TRANSLATION_QUEUE_SERVICE,
    BlogownerTranslationQueueService,
  ],
})
export class BlogownerTranslationQueueModule {}