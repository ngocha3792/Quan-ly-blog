import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
    // Kiểm tra an toàn: Bắt buộc phải có Secret Key, nếu không báo lỗi ngay lập tức
    if (!process.env.JWT_ACCESS_TOKEN_SECRET || !process.env.JWT_REFRESH_TOKEN_SECRET) {
        console.error('🔥 LỖI NGHIÊM TRỌNG: Thiếu JWT_ACCESS_TOKEN_SECRET hoặc JWT_REFRESH_TOKEN_SECRET trong file .env');
    }

    return {
        // --- ACCESS TOKEN ---
        // Chìa khóa để ký và xác thực Access Token
        secret: process.env.JWT_ACCESS_TOKEN_SECRET,
        // Thời gian sống của Access Token (Nên để ngắn: 15 phút - 1 giờ)
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',

        // --- REFRESH TOKEN ---
        // Chìa khóa riêng để ký Refresh Token (Nên khác với JWT_ACCESS_TOKEN_SECRET)
        refreshSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
        // Thời gian sống của Refresh Token (Nên để dài: 7 ngày - 30 ngày)
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

    };
});
