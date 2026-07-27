import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  JwtAuthGuard,
  PrismaService,
  RolesGuard,
} from '@app/core';

import { ModeratorPostsController } from './controllers/moderator-posts.controller';
import { ModeratorApiModule } from './moderator-api.module';
import { ModeratorPostsService } from './services/moderator-posts.service';

describe('ModeratorApiModule', () => {
  let testingModule: TestingModule | undefined;

  const mockPrismaService = {
    post: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },

    tag: {
      findFirst: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleBuilder = Test.createTestingModule({
      imports: [
        /**
         * PrismaService và các thành phần xác thực
         * sử dụng ConfigService.
         */
        ConfigModule.forRoot({
          isGlobal: true,
        }),

        ModeratorApiModule,
      ],
    });

    testingModule = await moduleBuilder
      /**
       * Không dùng PrismaService thật trong unit test module.
       * Tránh kết nối database và tránh phụ thuộc cấu hình DB.
       */
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)

      /**
       * Module test chỉ kiểm tra việc đăng ký
       * controller và service, không kiểm tra JWT.
       */
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })

      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })

      .compile();
  });

  afterEach(async () => {
    await testingModule?.close();
  });

  it('should be defined', () => {
    expect(testingModule).toBeDefined();
  });

  it('should resolve ModeratorPostsController', () => {
    const controller =
      testingModule!.get<ModeratorPostsController>(
        ModeratorPostsController,
      );

    expect(controller).toBeDefined();
  });

  it('should resolve ModeratorPostsService', () => {
    const service =
      testingModule!.get<ModeratorPostsService>(
        ModeratorPostsService,
      );

    expect(service).toBeDefined();
  });
});