import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';

export class TagAlreadyExistsException extends ConflictException {
    constructor(tagName: string) {
        super(`Thẻ "${tagName}" đã tồn tại`);
    }
}

export class TagNotFoundException extends NotFoundException {
    constructor(tagId: string) {
        super(`Không tìm thấy thẻ với id ${tagId}`);
    }
}