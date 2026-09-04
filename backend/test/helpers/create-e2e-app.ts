import { INestApplication, ValidationPipe } from '@nestjs/common';

import { Test } from '@nestjs/testing';

import { ConfigService } from '@nestjs/config';

import { AppModule } from '../../src/app.module';

import { HttpExceptionFilter } from '@app/core/common/filters/http-exception.filter';

import { PrismaClientExceptionFilter } from '@app/core/common/filters/prisma-client-exception.filter';

import { TransformInterceptor } from '@app/core/common/interceptors/transform.interceptor';

import { TrimPipe } from '@app/core/common/pipes/trim.pipe';

export async function createE2EApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';

  app.setGlobalPrefix(apiPrefix);

  const trustProxyHops = configService.get<number>('app.trustProxyHops') || 0;

  if (trustProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  }

  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new PrismaClientExceptionFilter(),
  );

  app.useGlobalPipes(
    new TrimPipe(),

    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  return app;
}
