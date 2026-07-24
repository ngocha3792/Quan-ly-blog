import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, ConflictException, UnsupportedMediaTypeException } from '@nestjs/common';

export class BlogOwnerRequestNotFoundException extends NotFoundException {
    constructor(id: string) {
        super(`Không tìm thấy yêu cầu trở thành tác giả với ID: ${id}`);
    }
}

export class ReportNotFoundException extends NotFoundException {
    constructor(reportId: string) {
        super(`Không tìm thấy báo cáo với ID: ${reportId}`);
    }
}

//Blog thì không thể thiếu việc upload ảnh bìa (thumbnail) hoặc ảnh chèn vào bài viết. 
// Nếu người dùng cố tình đổi đuôi một file .exe chứa virus thành .jpg hoặc tải lên định dạng file hệ thống không hỗ trợ,
//  đây là Exception bạn cần dùng.

export class UnsupportedFileTypeException extends UnsupportedMediaTypeException {
    constructor(allowedTypes: string[]) {
        // allowedTypes có thể là ['jpg', 'png', 'webp', 'mp4']
        super(`Định dạng file không được hỗ trợ. Hệ thống chỉ chấp nhận: ${allowedTypes.join(', ')}.`);
    }
}