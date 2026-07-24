
/*Khi dự án đưa lên môi trường thật (Production), bạn sẽ không biết ai đang gọi vào hệ thống của mình nếu không có log. Middleware này sẽ tự động ghi nhận lại Method, URL, IP, Mã trạng thái và Thời gian xử lý của từng Request.
*/
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    // Sử dụng Logger mặc định của NestJS để in ra console cho đẹp
    private logger = new Logger('HTTP');

    use(request: Request, response: Response, next: NextFunction): void {
        const { ip, method, originalUrl } = request;
        const userAgent = request.get('user-agent') || '';
        const startTime = Date.now(); // Bắt đầu tính giờ

        // Lắng nghe sự kiện 'finish' của Response (khi request đã xử lý xong)
        response.on('finish', () => {
            const { statusCode } = response;
            const contentLength = response.get('content-length');
            const duration = Date.now() - startTime; // Tính thời gian chạy

            // Format log: GET /api/posts 200 152B - PostmanRuntime/7.32.3 ::1 - 12ms
            this.logger.log(
                `${method} ${originalUrl} ${statusCode} ${contentLength}B - ${userAgent} ${ip} - ${duration}ms`,
            );
        });

        // Chuyển Request đi tiếp vào bên trong hệ thống (Guard, Controller...)
        next();
    }
}
