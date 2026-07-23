//Trong NestJS, Exception Filters (Bộ lọc ngoại lệ) chính là chốt chặn cuối cùng. Khi các Custom Exceptions 
// mà chúng ta vừa tạo ở trên được ném ra (throw), Filter sẽ "tóm" lấy chúng trước khi chúng bay về Frontend, 
// sau đó nhào nặn lại thành một cấu trúc JSON đồng nhất, chuẩn chỉ và đẹp mắt.
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception.getStatus();

        // Lấy chi tiết lỗi từ exception
        const exceptionResponse = exception.getResponse();

        // Xử lý thông báo lỗi (Message)
        // Nếu là lỗi từ class-validator (DTO), message thường là một mảng (Array).
        // Nếu là lỗi Custom do ta tự định nghĩa, message là một chuỗi (String).
        let errorMessage = 'Đã có lỗi xảy ra';
        if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
            errorMessage = (exceptionResponse as any).message || exceptionResponse;
        } else if (typeof exceptionResponse === 'string') {
            errorMessage = exceptionResponse;
        }

        // Chuẩn hóa format JSON trả về cho Frontend
        response.status(status).json({
            success: false,
            statusCode: status,
            message: errorMessage,
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
}
