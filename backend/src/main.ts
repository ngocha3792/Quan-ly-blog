import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '@app/core/common/filters/http-exception.filter';
import { PrismaClientExceptionFilter } from '@app/core/common/filters/prisma-client-exception.filter';
import { TransformInterceptor } from '@app/core/common/interceptors/transform.interceptor';
import { TrimPipe } from '@app/core/common/pipes/trim.pipe';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Lấy Global Prefix từ cấu hình (env: API_PREFIX)
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Cấu hình CORS để Frontend (hoặc Mobile) có thể gọi API
  const frontendUrl = configService.get<string>('app.frontendUrl') || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // Thêm Global Interceptors (định dạng response trả về)
  app.useGlobalInterceptors(new TransformInterceptor());

  // Thêm Global Filters (xử lý ngoại lệ chuẩn)
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new PrismaClientExceptionFilter()
  );

  // Thêm Global Pipes (dọn dẹp dữ liệu đầu vào và validate)
  app.useGlobalPipes(
    new TrimPipe(),
    new ValidationPipe({ transform: true })
  );

  // Khởi động ở cổng APP_PORT từ file cấu hình (env: APP_PORT)
  const port = configService.get<number>('app.port') || 8080;
  await app.listen(port);
  console.log(`🚀 Ứng dụng Monolith đã chạy trên: http://localhost:${port}/${apiPrefix}`);
}
bootstrap();
