import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

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

export class DefaultLanguageMustBeActiveException extends BadRequestException {
  constructor() {
    super('Ngôn ngữ mặc định phải ở trạng thái hoạt động');
  }
}

export class DefaultLanguageCannotBeUnsetException extends BadRequestException {
  constructor() {
    super(
      'Không thể bỏ trạng thái mặc định trực tiếp. Hãy đặt một ngôn ngữ khác làm mặc định',
    );
  }
}

export class DefaultLanguageCannotBeDeactivatedException extends BadRequestException {
  constructor() {
    super(
      'Không thể vô hiệu hóa ngôn ngữ mặc định. Hãy đặt một ngôn ngữ khác làm mặc định trước',
    );
  }
}

export class DefaultLanguageCannotBeDeletedException extends BadRequestException {
  constructor() {
    super(
      'Không thể xóa ngôn ngữ mặc định. Hãy đặt một ngôn ngữ khác làm mặc định trước',
    );
  }
}

export class DefaultLanguageConflictException extends ConflictException {
  constructor() {
    super(
      'Ngôn ngữ mặc định vừa được thay đổi bởi một request khác. Vui lòng thử lại',
    );
  }
}
