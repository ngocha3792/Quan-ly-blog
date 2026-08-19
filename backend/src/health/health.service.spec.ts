import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@app/core';

import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('should report the process as alive', () => {
    const result = service.getLiveness();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('blog-api');
    expect(typeof result.uptimeSeconds).toBe('number');
  });

  it('should report readiness when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const result = await service.getReadiness();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('should return 503 when the database is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection failed'));

    await expect(service.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
