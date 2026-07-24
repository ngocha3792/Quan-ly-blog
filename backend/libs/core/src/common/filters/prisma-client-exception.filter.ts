//Nếu dự án của bạn dùng Prisma,
// đôi khi Database sẽ văng ra lỗi trực tiếp (ví dụ lỗi P2002 khi lưu trùng Slug hoặc Email) mà tầng Service chưa kịp kiểm tra.
// Bộ lọc này sẽ dịch lỗi của Database thành mã HTTP chuẩn.
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
    catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Lỗi cơ sở dữ liệu không xác định.';

        // Dịch mã lỗi của Prisma
        switch (exception.code) {
            case 'P2002': // Lỗi vi phạm Unique Constraint (Trùng lặp dữ liệu)
                status = HttpStatus.CONFLICT;
                const target = exception.meta?.target as string[];
                message = `Dữ liệu bị trùng lặp ở trường: ${target ? target.join(', ') : 'không xác định'}.`;
                break;
            case 'P2025': // Lỗi không tìm thấy Record khi Update/Delete
                status = HttpStatus.NOT_FOUND;
                message = 'Dữ liệu bạn muốn thao tác không tồn tại trong hệ thống.';
                break;
            // Có thể thêm các case mã lỗi Prisma khác ở đây
        }

        response.status(status).json({
            success: false,
            statusCode: status,
            timestamp: new Date().toISOString(),
            message: message,
        });
    }
}
