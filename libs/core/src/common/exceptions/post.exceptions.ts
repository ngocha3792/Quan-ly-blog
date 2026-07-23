import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';

// Mục đích: Rất quan trọng trong hệ thống Blog nhiều tác giả. Nếu User A cố tình gọi API xóa bài viết của User B, 
// Guard vẫn cho qua (vì A có đăng nhập), nhưng Service sẽ phải chặn lại và ném ra lỗi này.

export class NotPostOwnerException extends ForbiddenException {
    constructor() {
        super('Bạn không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác.');
    }
}

//Mục đích: Một bài viết đang ở trạng thái PUBLISHED (Đã xuất bản) thì không thể gọi API "Xuất bản" thêm một lần nữa. 
// Đây là lỗi vi phạm luồng trạng thái (State Transition).


export class PostAlreadyPublishedException extends BadRequestException {
    constructor(postId: string) {
        super(`Bài viết (ID: ${postId}) đã được xuất bản trước đó. Không thể thực hiện lại thao tác này.`);
    }
}

//Mục đích: Thay vì quăng một cái NotFoundException('Not found') chung chung,
//  Exception này sẽ báo chính xác bài viết nào (theo ID hoặc Slug) không tồn tại 
// để Frontend dễ dàng báo lỗi 404 cho người đọc.

export class PostNotFoundException extends NotFoundException {
    constructor(identifier: string) {
        // identifier có thể là ID hoặc URL Slug của bài viết
        super(`Không tìm thấy bài viết với định danh: ${identifier}. Bài viết có thể đã bị xóa hoặc ẩn.`);
    }
}

export class TagLimitExceptions extends BadRequestException {
    constructor(limit: number) {
        super(`Mỗi bài viết chỉ được gắn tối đa ${limit} thẻ (tags). Vui lòng xóa bớt thẻ và thử lại.`);
    }
}