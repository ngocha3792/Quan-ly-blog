import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

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

/**
 * User đã vượt quá số comment được phép
 * trong sliding window hiện tại.
 */
export class CommentRateLimitExceededException extends HttpException {
  constructor() {
    super(
      'Bạn thao tác quá nhanh. Chỉ được gửi tối đa 5 bình luận trong 1 phút.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
