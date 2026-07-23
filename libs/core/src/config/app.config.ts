import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    name: process.env.APP_NAME || 'NestJS Blog API',

    // Ép kiểu chuỗi từ .env sang số an toàn
    port: parseInt(process.env.APP_PORT || process.env.PORT || '8080', 10),

    // Tiền tố cho toàn bộ API (VD: /api/v1)
    apiPrefix: process.env.API_PREFIX || 'api',

    // Domain của Frontend để cấu hình CORS (Chống lỗi chặn nguồn chéo)
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

    // Chế độ bảo trì mà Middleware lúc nãy chúng ta viết đang cần
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true',

    // Pepper dùng để băm password
    passwordPepper: process.env.PASSWORD_PEPPER || '',
}));
