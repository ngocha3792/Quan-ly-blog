import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';

export class CommentNotFoundException extends NotFoundException {
    constructor(commentId: string) {
        super(`Không tìm thấy bình luận với ID: ${commentId}`);
    }
}

export class NotCommentOwnerException extends ForbiddenException {
    constructor() {
        super('Bạn không có quyền chỉnh sửa hoặc xóa bình luận của người khác.');
    }
}