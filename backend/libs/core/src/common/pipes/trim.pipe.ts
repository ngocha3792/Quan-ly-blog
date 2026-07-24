/*Người dùng (và cả Frontend) rất hay để lại những khoảng trắng vô tình khi nhập liệu, ví dụ như "  tuan@gmail.com " hay " Tiêu đề bài viết   ". Thay vì phải gọi hàm .trim() thủ công ở mọi nơi trong Service, ta viết một Pipe tự động dọn dẹp sạch sẽ toàn bộ Request Body trước khi nó vào Controller.*/
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
    transform(values: any, metadata: ArgumentMetadata) {
        // Chỉ xử lý dữ liệu từ Body (POST, PUT, PATCH), bỏ qua Query hoặc Params
        if (metadata.type !== 'body') {
            return values;
        }
        return this.cleanObject(values);
    }

    // Hàm đệ quy để duyệt qua toàn bộ object và cắt khoảng trắng của các chuỗi
    private cleanObject(values: any): any {
        if (typeof values === 'string') {
            return values.trim();
        }

        // Nếu không phải object hoặc là null thì giữ nguyên (số, boolean...)
        if (typeof values !== 'object' || values === null) {
            return values;
        }

        // Nếu là mảng hoặc object, đệ quy để dọn dẹp từng phần tử bên trong
        Object.keys(values).forEach((key) => {
            values[key] = this.cleanObject(values[key]);
        });

        return values;
    }
}
