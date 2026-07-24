import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';

//Hệ thống Blog thường có tính năng khóa tài khoản (Ban/Suspend) nếu người dùng thường xuyên spam hoặc đăng nội dung vi phạm.
//  Khi tài khoản bị khóa, dù họ có JWT Token hợp lệ, họ cũng không được phép thao tác.

export class AccountBannedException extends ForbiddenException {
    constructor(reason?: string) {
        const message = reason
            ? `Tài khoản của bạn đã bị khóa. Lý do: ${reason}`
            : 'Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng.';
        super(message);
    }
}

//Mục đích: Khi người dùng đăng nhập sai email hoặc mật khẩu.

//Lưu ý bảo mật: Chúng ta tuyệt đối không ném ra lỗi kiểu "Sai mật khẩu" hay "Email không tồn tại" ở API Login,
// vì hacker có thể dùng thông tin đó để dò quét xem email nào đã đăng ký trên hệ thống của bạn.
// Luôn gộp chung thành một lỗi duy nhất.


export class InvalidCredentialsException extends UnauthorizedException {
    constructor() {
        super('Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.');
    }
}

export class SessionInvalidException extends UnauthorizedException {
    constructor() {
        super('Phiên đăng nhập không hợp lệ');
    }
}

export class TokenNotValidException extends UnauthorizedException {
    constructor(typeToken: string) {
        super(`${typeToken} không hợp lệ hoặc đã hết hạn`);
    }
}