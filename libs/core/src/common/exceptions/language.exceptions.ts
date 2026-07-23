import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';

export class LanguageAlreadyExistsException extends ConflictException {
    constructor(name: string) {
        super(`Mã ngôn ngữ ${name} đã tồn tại`);
    }
}

export class LanguageNotFoundException extends NotFoundException {
    constructor(id: string) {
        super(`Không tìm thấy ngôn ngữ với ID: ${id}`);
    }
}