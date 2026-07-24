import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
    // Kiểm tra an toàn sơ bộ: Báo lỗi ngay lúc khởi động nếu quên gắn link DB
    if (!process.env.DATABASE_URL) {
        console.error('🔥 LỖI NGHIÊM TRỌNG: Chưa cấu hình DATABASE_URL trong file .env');
    }

    return {
        // Chuỗi kết nối Database chính (PostgreSQL, MySQL...)
        url: process.env.DATABASE_URL,

        // Chế độ bật log SQL: Khi ở môi trường Dev, ta muốn xem Prisma render ra câu SQL nào
        // VD trong .env: DB_LOG_QUERIES=true
        logQueries: process.env.DB_LOG_QUERIES === 'true',

        // Cấu hình số lượng kết nối tối đa (Connection Pool)
        // Tùy thuộc vào cấu hình server, mặc định để 10
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    };
});
