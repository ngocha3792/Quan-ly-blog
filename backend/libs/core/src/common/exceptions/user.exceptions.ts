import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';

//Mục đích: Xử lý ngay lập tức khi người dùng đăng ký tài khoản mới (POST /auth/register)
//  hoặc cập nhật hồ sơ (PUT /users/profile) mà nhập trùng email của người khác.

export class EmailAlreadyExistsException extends ConflictException {
    constructor(email: string) {
        super(`Địa chỉ email "${email}" đã được sử dụng. Vui lòng chọn một email khác hoặc đăng nhập.`);
    }
}

export class ExistActionNotAllowedException extends BadRequestException {
    constructor(action: string, target: string) {
        super(`Bạn đã thực hiện hành động "${action}" cho "${target}" rồi`);
    }
}

//Mục đích: Chặn người dùng tự Follow (theo dõi) chính tài khoản của mình, hoặc tự báo cáo (Report) bài viết của chính mình.

export class SelfActionNotAllowedException extends BadRequestException {
    constructor(action: string) {
        // action có thể là 'follow', 'report'
        super(`Bạn không thể tự thực hiện hành động "${action}" lên chính tài khoản hoặc nội dung của mình.`);
    }
}

//Mục đích: Dùng khi muốn xem trang cá nhân (Profile) của một tác giả không tồn tại, 
// hoặc khi người dùng nhập email để sử dụng tính năng "Quên mật khẩu" nhưng email đó chưa từng được đăng ký.


export class UserNotFoundException extends NotFoundException {
    constructor(identifier: string) {
        // identifier có thể là User ID, Username hoặc Email
        super(`Không tìm thấy người dùng: ${identifier}. Tài khoản có thể không tồn tại hoặc đã bị xóa.`);
    }
}

export class UsernameAlreadyExistsException extends ConflictException {
    constructor(username: string) {
        super(`Tên người dùng "${username}" đã được sử dụng. Vui lòng chọn một tên người dùng khác hoặc đăng nhập.`);
    }
}
