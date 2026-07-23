import * as bcrypt from "bcrypt";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BcryptUtil {
    constructor(private readonly configService: ConfigService) { }

    // Lấy pepper từ ConfigService (đã khai báo trong app.config.ts)
    private get pepper(): string {
        return this.configService.get<string>('app.passwordPepper') || '';
    }

    // Dùng Bcrypt băm cùng với password + pepper, thuật toán sẽ chạy 2^10 lần
    // Giúp tăng cường bảo mật
    async hashPassword(password: string): Promise<string> {
        const passwordwithpepper = password + this.pepper;
        return await bcrypt.hash(passwordwithpepper, 10);
    }

    // So sánh mật khẩu với hash (cũng dùng password + pepper)
    async comparePassword(password: string, hash: string): Promise<boolean> {
        const passwordwithpepper = password + this.pepper;
        return await bcrypt.compare(passwordwithpepper, hash);
    }
}
