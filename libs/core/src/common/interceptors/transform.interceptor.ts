/*Hãy tưởng tượng, nếu không có Interceptor, các Controller của bạn sẽ trả về dữ liệu rất lộn xộn:

API lấy 1 bài viết trả về: { id: 1, title: 'Bài viết 1' }

API lấy danh sách trả về: [{ id: 1... }, { id: 2... }]

API xóa bài viết trả về: 'Xóa thành công'

Frontend sẽ rất vất vả vì lúc thì nhận object, lúc thì nhận mảng, lúc thì nhận chuỗi. Interceptor sẽ đứng chặn ở cửa ra, gom tất cả những gì Controller trả về (gọi là data), và bọc nó vào một form duy nhất.
*/

import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { ResponseFormat } from '../interfaces';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseFormat<T>> {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();

        // next.handle() chính là hàm chạy Controller của bạn.
        // Lệnh .pipe(map(...)) của RxJS sẽ lấy kết quả Controller trả về (gọi là `data`)
        // và biến đổi nó trước khi gửi về cho người dùng (Frontend).
        return next.handle().pipe(
            map((data) => ({
                success: true,
                statusCode: response.statusCode, // Lấy mã status (200, 201...)
                data: data || null, // Nếu controller không trả về gì, gán là null
                timestamp: new Date().toISOString(),
            })),
        );
    }
}
