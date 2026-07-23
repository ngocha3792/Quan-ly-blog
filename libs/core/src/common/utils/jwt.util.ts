import { Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

//  Khai báo một Type quy định chuẩn thời gian của JWT
type JwtTime = `${number}s` | `${number}m` | `${number}h` | `${number}d` | number;
@Injectable()
export class JWTUtil {

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // Tạo ra cả Access Token và Refresh Token với Access Token có thời hạn 15 phút và Refresh Token có thời hạn 7 ngày
    generateToken(userId: string, role: string, email: string) {
        const payload = { sub: userId, role, email };

        // 1. Lấy cấu hình từ ConfigService thông qua namespace 'jwt'
        const accessTokenSecretKey = this.configService.get<string>('jwt.secret');
        const refreshTokenSecretKey = this.configService.get<string>('jwt.refreshSecret');

        // Lấy thời hạn token (đã có default value trong jwt.config.ts)
        const accessTime = this.configService.get<JwtTime>('jwt.expiresIn');
        const refreshTime = this.configService.get<JwtTime>('jwt.refreshExpiresIn');

        // 2. Kiểm tra an toàn: Nếu quên cấu hình trong .env thì báo lỗi Server ngay
        if (!accessTokenSecretKey) {
            throw new InternalServerErrorException('Thiếu cấu hình JWT_ACCESS_TOKEN_SECRET trong file .env');
        }
        if (!refreshTokenSecretKey) {
            throw new InternalServerErrorException('Thiếu cấu hình JWT_REFRESH_TOKEN_SECRET trong file .env');
        }

        // 3. Tiến hành ký Token
        const accessToken = this.jwtService.sign(payload, {
            secret: accessTokenSecretKey,
            expiresIn: accessTime,
        });

        const refreshToken = this.jwtService.sign(payload, {
            secret: refreshTokenSecretKey,
            expiresIn: refreshTime,
        });

        return { accessToken, refreshToken };
    }

    /**
     * Cấp lại Access Token mới
     */
    generateAccessToken(userId: string, role: string, email: string) {
        const payload = { sub: userId, role, email };
        const secret = this.configService.get<string>('jwt.secret');
        const expiresIn = this.configService.get<JwtTime>('jwt.expiresIn');

        if (!secret) {
            throw new InternalServerErrorException('Thiếu cấu hình JWT_ACCESS_TOKEN_SECRET trong file .env');
        }

        const accessToken = this.jwtService.sign(payload, {
            secret,
            expiresIn,
        });

        return accessToken;
    }
    /**
   * Xác thực Access Token(Stateless - Không cần chọc vào DB)
   */
    verifyAccessToken(token: string) {
        const secret = this.configService.get<string>('jwt.secret');

        // Kiểm tra an toàn: Tránh lỗi văng ra từ thư viện do secret bị undefined
        if (!secret) {
            throw new InternalServerErrorException('Thiếu cấu hình JWT_ACCESS_TOKEN_SECRET trong file .env');
        }

        try {
            return this.jwtService.verify(token, { secret });
        } catch (error) {
            this.handleJwtError(error, 'Access Token');
        }
    }

    /**
     * Xác thực Refresh Token((Kiểm tra chữ ký và hạn sử dụng cơ bản - cần chọc vào DB)) 
     */
    verifyRefreshToken(token: string) {
        const secret = this.configService.get<string>('jwt.refreshSecret');

        if (!secret) {
            throw new InternalServerErrorException('Thiếu cấu hình JWT_REFRESH_TOKEN_SECRET trong file .env');
        }

        try {
            return this.jwtService.verify(token, { secret });
        } catch (error) {
            this.handleJwtError(error, 'Refresh Token');
        }
    }

    private handleJwtError(error: any, tokenType: string): never {
        if (error.name === 'TokenExpiredError') {
            throw new UnauthorizedException(`${tokenType} đã hết hạn.`);
        }
        // Các lỗi khác như JsonWebTokenError, NotBeforeError...
        throw new UnauthorizedException(`${tokenType} không hợp lệ hoặc đã bị chỉnh sửa.`);
    }
}
