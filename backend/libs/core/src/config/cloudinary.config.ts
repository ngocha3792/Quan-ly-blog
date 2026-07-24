import { registerAs } from '@nestjs/config';

export default registerAs('cloudinary', () => {
    // Báo cảnh báo (Warn) thay vì Lỗi (Error) để không làm sập server lúc khởi động 
    // nếu bạn đang test local và chưa cần dùng đến tính năng upload ảnh.
    if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
    ) {
        console.warn('⚠️ CẢNH BÁO: Thiếu cấu hình Cloudinary trong file .env. Tính năng upload ảnh sẽ không hoạt động.');
    }

    return {
        // Tên không gian lưu trữ của bạn trên Cloudinary
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,

        // Khóa công khai
        apiKey: process.env.CLOUDINARY_API_KEY,

        // Khóa bí mật (Tuyệt đối không để lộ)
        apiSecret: process.env.CLOUDINARY_API_SECRET,

        // Thư mục gốc trên Cloudinary để chứa ảnh của dự án này (giúp gọn gàng nếu bạn dùng 1 acc Cloudinary cho nhiều dự án)
        defaultFolder: process.env.CLOUDINARY_DEFAULT_FOLDER || 'nestjs_blog',
    };
});
