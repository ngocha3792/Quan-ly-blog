import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';

export class CategoryAlreadyExistsException extends ConflictException {
    constructor(name: string) {
        super(`Danh mục "${name}" đã tồn tại.`);
    }
}

export class CategoryNotFoundException extends NotFoundException {
    constructor(id: number) {
        super(`Danh mục với id ${id} không tồn tại.`);
    }
}