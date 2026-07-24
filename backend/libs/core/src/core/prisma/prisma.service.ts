import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor(configService: ConfigService) {
        // Lấy cấu hình URL và cờ log
        const url = configService.get<string>('database.url');
        const logQueries = configService.get<boolean>('database.logQueries');

        // Khởi tạo connection pool thông qua 'pg'
        const pool = new Pool({ connectionString: url });

        // Tạo Prisma Adapter (Bắt buộc từ Prisma v7 đối với SQL DB)
        const adapter = new PrismaPg(pool);

        // Truyền tham số cấu hình vào PrismaClient
        super({
            adapter,
            // Đọc cờ logQueries để quyết định có in câu SQL ra Terminal không
            log: logQueries ? ['query', 'info', 'warn', 'error'] : ['error'],
        });
    }

    // Hook của NestJS: Tự động chạy khi Module khởi tạo xong
    async onModuleInit() {
        await this.$connect();
    }

    // Hook của NestJS: Tự động chạy khi Server tắt
    async onModuleDestroy() {
        await this.$disconnect();
    }
}
