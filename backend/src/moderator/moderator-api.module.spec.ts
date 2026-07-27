import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  JwtAuthGuard,
  PrismaService,
  RolesGuard,
} from '@app/core';

import { ModeratorPostsController } from './controllers/moderator-posts.controller';
import { ModeratorReportsController } from './controllers/moderator-reports.controller';

import { ModeratorApiModule } from './moderator-api.module';

import { ModeratorPostsService } from './services/moderator-posts.service';
import { ModeratorReportsService } from './services/moderator-reports.service';

describe('ModeratorApiModule', () => {
  let testingModule: TestingModule | undefined;

  const mockPrismaService = {
    post: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },

    comment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },

    report: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
        ConfigModule.forRoot({
          isGlobal: true,
        }),

        ModeratorApiModule,
      ],
    });

    testingModule = await moduleBuilder
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)

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

  it('should resolve ModeratorReportsController', () => {
    const controller =
      testingModule!.get<ModeratorReportsController>(
        ModeratorReportsController,
      );

    expect(controller).toBeDefined();
  });

  it('should resolve ModeratorReportsService', () => {
    const service =
      testingModule!.get<ModeratorReportsService>(
        ModeratorReportsService,
      );

    expect(service).toBeDefined();
  });
});