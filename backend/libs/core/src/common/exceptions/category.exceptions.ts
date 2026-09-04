import { NotFoundException, ConflictException } from '@nestjs/common';

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

export class CategoryGroupAlreadyExistsException extends ConflictException {
  constructor(code: string) {
    super(`Nhóm danh mục với mã "${code}" đã tồn tại.`);
  }
}

export class CategoryGroupNotFoundException extends NotFoundException {
  constructor(id: number) {
    super(`Nhóm danh mục với id ${id} không tồn tại.`);
  }
}
