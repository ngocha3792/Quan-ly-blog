import { Injectable } from '@nestjs/common';
import { InvalidCredentialsException, TokenNotValidException, SessionInvalidException, AccountBannedException } from '@app/core/common/exceptions';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
import { BcryptUtil, JWTUtil } from '@app/core/common/utils';
import { LoginDto, RegisterDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto';

@Injectable()
export class AuthsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly usersService: UsersService,
        private readonly bcryptUtil: BcryptUtil,
        private readonly jwtUtil: JWTUtil,
    ) { }

    async register(registerDto: RegisterDto) {
        return this.usersService.create(registerDto);
    }

    async login(loginDto: LoginDto, ipAddress?: string, deviceInfo?: string) {
        const user = await this.usersService.findByEmailorUsername(loginDto.identifier);

        if (!user) {
            throw new InvalidCredentialsException();
        }

        if (user.status === 'LOCKED') {
            throw new AccountBannedException(user.lockReason || undefined);
        }

        const isMatch = await this.bcryptUtil.comparePassword(loginDto.password, user.passwordHash);
        if (!isMatch) {
            throw new InvalidCredentialsException();
        }

        const tokens = this.jwtUtil.generateToken(user.id.toString(), user.role, user.email);

        const refreshTokenHash = await this.bcryptUtil.hashPassword(tokens.refreshToken);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.prisma.userSession.create({
            data: {
                userId: user.id,
                refreshTokenHash,
                deviceInfo,
                ipAddress,
                expiresAt,
            }
        });

        return {
            user: new UserEntity(user),
            tokens,
        };
    }

    async refreshToken(refreshTokenDto: RefreshTokenDto, ipAddress?: string, deviceInfo?: string) {
        const payload = this.jwtUtil.verifyRefreshToken(refreshTokenDto.refreshToken);
        const userId = parseInt(payload.sub, 10);

        const activeSessions = await this.prisma.userSession.findMany({
            where: {
                userId,
                revokedAt: null,
                expiresAt: {
                    gt: new Date()
                }
            }
        });

        if (activeSessions.length === 0) {
            throw new TokenNotValidException('Refresh Token');
        }

        let currentSessionId: number | null = null;
        for (const session of activeSessions) {
            const isMatch = await this.bcryptUtil.comparePassword(refreshTokenDto.refreshToken, session.refreshTokenHash);
            if (isMatch) {
                // Kiểm tra xem thiết bị gửi request có khớp với thiết bị lúc đăng nhập không
                const isDeviceChanged = session.deviceInfo && deviceInfo && session.deviceInfo !== deviceInfo;
                // Có thể kiểm tra thêm IP, nhưng lưu ý IP mạng di động/wifi có thể thay đổi liên tục
                // const isIpChanged = session.ipAddress && ipAddress && session.ipAddress !== ipAddress;

                if (isDeviceChanged) {
                    // Phát hiện bất thường -> Tự động thu hồi phiên đăng nhập này ngay lập tức để bảo vệ tài khoản
                    await this.prisma.userSession.update({
                        where: { id: session.id },
                        data: { revokedAt: new Date() }
                    });
                    throw new SessionInvalidException(); // Hoặc throw một Exception cảnh báo bảo mật
                }

                currentSessionId = session.id;
                break;
            }
        }

        if (!currentSessionId) {
            throw new SessionInvalidException();
        }

        const accessToken = this.jwtUtil.generateAccessToken(payload.sub, payload.role, payload.email);

        return {
            accessToken
        };
    }

    async logout(refreshTokenDto: RefreshTokenDto) {
        const payload = this.jwtUtil.verifyRefreshToken(refreshTokenDto.refreshToken);
        const userId = parseInt(payload.sub, 10);

        const activeSessions = await this.prisma.userSession.findMany({
            where: {
                userId,
                revokedAt: null,
            }
        });

        for (const session of activeSessions) {
            const isMatch = await this.bcryptUtil.comparePassword(refreshTokenDto.refreshToken, session.refreshTokenHash);
            if (isMatch) {
                await this.prisma.userSession.update({
                    where: { id: session.id },
                    data: { revokedAt: new Date() }
                });
                break;
            }
        }

        return { message: 'Đăng xuất thiết bị hiện tại thành công' };
    }

    async logoutAll(userId: number) {
        await this.prisma.userSession.updateMany({
            where: {
                userId,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date()
            }
        });

        return { message: 'Đăng xuất khỏi tất cả các thiết bị thành công' };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.usersService.findByEmailorUsername(dto.email);
        if (!user) {
            // Trả về thông báo chung chung để tránh dò rỉ thông tin (User Enumeration)
            return { message: 'Nếu email hợp lệ, một liên kết khôi phục đã được gửi đi.' };
        }

        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = await this.bcryptUtil.hashPassword(token);

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            }
        });

        // Gửi email // sẽ làm sau
        return {
            token,
            message: 'Nếu email hợp lệ, một liên kết khôi phục đã được gửi đi.',
        };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const activeTokens = await this.prisma.passwordResetToken.findMany({
            where: {
                usedAt: null,
                expiresAt: {
                    gt: new Date()
                }
            }
        });

        let currentTokenId: number | null = null;
        let userId: number | null = null;

        for (const pt of activeTokens) {
            const isMatch = await this.bcryptUtil.comparePassword(dto.token, pt.tokenHash);
            if (isMatch) {
                currentTokenId = pt.id;
                userId = pt.userId;
                break;
            }
        }

        if (!currentTokenId || !userId) {
            throw new TokenNotValidException('Reset Password Token');
        }

        const newPasswordHash = await this.bcryptUtil.hashPassword(dto.newPassword);

        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash }
        });

        await this.prisma.passwordResetToken.update({
            where: { id: currentTokenId },
            data: { usedAt: new Date() }
        });

        // Ép đăng xuất khỏi mọi thiết bị để bảo vệ tài khoản
        await this.logoutAll(userId);

        return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
    }
}
