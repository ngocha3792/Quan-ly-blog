import { Test, TestingModule } from '@nestjs/testing';
import { AuthsService } from './auths.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { BcryptUtil, JWTUtil } from '@app/core/common/utils';
import { InvalidCredentialsException, TokenNotValidException, SessionInvalidException, AccountBannedException } from '@app/core/common/exceptions';

describe('AuthsService', () => {
    let service: AuthsService;
    let prisma: PrismaService;
    let usersService: UsersService;
    let bcryptUtil: BcryptUtil;
    let jwtUtil: JWTUtil;

    const mockPrismaService = {
        userSession: {
            create: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        passwordResetToken: {
            create: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
        user: {
            update: jest.fn(),
        }
    };

    const mockUsersService = {
        create: jest.fn(),
        findByEmailorUsername: jest.fn(),
    };

    const mockBcryptUtil = {
        comparePassword: jest.fn(),
        hashPassword: jest.fn(),
    };

    const mockJwtUtil = {
        generateToken: jest.fn(),
        verifyRefreshToken: jest.fn(),
        generateAccessToken: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthsService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: UsersService, useValue: mockUsersService },
                { provide: BcryptUtil, useValue: mockBcryptUtil },
                { provide: JWTUtil, useValue: mockJwtUtil },
            ],
        }).compile();

        service = module.get<AuthsService>(AuthsService);
        prisma = module.get<PrismaService>(PrismaService);
        usersService = module.get<UsersService>(UsersService);
        bcryptUtil = module.get<BcryptUtil>(BcryptUtil);
        jwtUtil = module.get<JWTUtil>(JWTUtil);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('register', () => {
        it('should call usersService.create', async () => {
            const dto: any = { email: 'test@example.com' };
            mockUsersService.create.mockResolvedValueOnce({ id: 1 });
            const result = await service.register(dto);
            expect(usersService.create).toHaveBeenCalledWith(dto);
            expect(result).toEqual({ id: 1 });
        });
    });

    describe('login', () => {
        const loginDto: any = { identifier: 'test', password: 'password123' };

        it('should throw InvalidCredentialsException if user not found', async () => {
            mockUsersService.findByEmailorUsername.mockResolvedValueOnce(null);
            await expect(service.login(loginDto)).rejects.toThrow(InvalidCredentialsException);
        });

        it('should throw AccountBannedException if user is locked', async () => {
            mockUsersService.findByEmailorUsername.mockResolvedValueOnce({ status: 'LOCKED', lockReason: 'spam' });
            await expect(service.login(loginDto)).rejects.toThrow(AccountBannedException);
        });

        it('should throw InvalidCredentialsException if password does not match', async () => {
            mockUsersService.findByEmailorUsername.mockResolvedValueOnce({ status: 'ACTIVE', passwordHash: 'hash' });
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(false);
            await expect(service.login(loginDto)).rejects.toThrow(InvalidCredentialsException);
        });

        it('should return user and tokens on successful login', async () => {
            const user = { id: 1, role: 'USER', email: 'test@example.com', status: 'ACTIVE', passwordHash: 'hash' };
            mockUsersService.findByEmailorUsername.mockResolvedValueOnce(user);
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(true);
            const tokens = { accessToken: 'access', refreshToken: 'refresh' };
            mockJwtUtil.generateToken.mockReturnValue(tokens);
            mockBcryptUtil.hashPassword.mockResolvedValueOnce('refreshHash');
            
            const result = await service.login(loginDto, '127.0.0.1', 'device-1');
            
            expect(prisma.userSession.create).toHaveBeenCalled();
            expect(result.tokens).toEqual(tokens);
            expect(result.user).toBeDefined();
        });
    });

    describe('refreshToken', () => {
        const dto: any = { refreshToken: 'refresh' };

        it('should throw TokenNotValidException if no active sessions', async () => {
            mockJwtUtil.verifyRefreshToken.mockReturnValue({ sub: '1' });
            mockPrismaService.userSession.findMany.mockResolvedValueOnce([]);
            await expect(service.refreshToken(dto)).rejects.toThrow(TokenNotValidException);
        });

        it('should throw SessionInvalidException if device changed', async () => {
            mockJwtUtil.verifyRefreshToken.mockReturnValue({ sub: '1' });
            const session = { id: 1, refreshTokenHash: 'hash', deviceInfo: 'device-1' };
            mockPrismaService.userSession.findMany.mockResolvedValueOnce([session]);
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(true);
            
            await expect(service.refreshToken(dto, 'ip', 'device-2')).rejects.toThrow(SessionInvalidException);
            expect(prisma.userSession.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { revokedAt: expect.any(Date) }
            });
        });

        it('should throw SessionInvalidException if token hash does not match any session', async () => {
            mockJwtUtil.verifyRefreshToken.mockReturnValue({ sub: '1' });
            const session = { id: 1, refreshTokenHash: 'hash' };
            mockPrismaService.userSession.findMany.mockResolvedValueOnce([session]);
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(false);
            
            await expect(service.refreshToken(dto)).rejects.toThrow(SessionInvalidException);
        });

        it('should return new access token if successful', async () => {
            mockJwtUtil.verifyRefreshToken.mockReturnValue({ sub: '1', role: 'USER', email: 'test@example.com' });
            const session = { id: 1, refreshTokenHash: 'hash', deviceInfo: 'device-1' };
            mockPrismaService.userSession.findMany.mockResolvedValueOnce([session]);
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(true);
            mockJwtUtil.generateAccessToken.mockReturnValue('new-access');
            
            const result = await service.refreshToken(dto, 'ip', 'device-1');
            expect(result).toEqual({ accessToken: 'new-access' });
        });
    });

    describe('logout', () => {
        it('should revoke session and return success message', async () => {
            mockJwtUtil.verifyRefreshToken.mockReturnValue({ sub: '1' });
            const session = { id: 1, refreshTokenHash: 'hash' };
            mockPrismaService.userSession.findMany.mockResolvedValueOnce([session]);
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(true);
            
            const result = await service.logout({ refreshToken: 'refresh' });
            
            expect(prisma.userSession.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { revokedAt: expect.any(Date) }
            });
            expect(result).toEqual({ message: 'Đăng xuất thiết bị hiện tại thành công' });
        });

        it('should not update session if hash does not match', async () => {
            mockJwtUtil.verifyRefreshToken.mockReturnValue({ sub: '1' });
            const session = { id: 1, refreshTokenHash: 'hash' };
            mockPrismaService.userSession.findMany.mockResolvedValueOnce([session]);
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(false);
            
            const result = await service.logout({ refreshToken: 'refresh' });
            
            expect(prisma.userSession.update).not.toHaveBeenCalled();
            expect(result).toEqual({ message: 'Đăng xuất thiết bị hiện tại thành công' });
        });
    });

    describe('logoutAll', () => {
        it('should update all sessions and return success message', async () => {
            const result = await service.logoutAll(1);
            expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
                where: { userId: 1, revokedAt: null },
                data: { revokedAt: expect.any(Date) }
            });
            expect(result).toEqual({ message: 'Đăng xuất khỏi tất cả các thiết bị thành công' });
        });
    });

    describe('forgotPassword', () => {
        it('should return message if user not found', async () => {
            mockUsersService.findByEmailorUsername.mockResolvedValueOnce(null);
            const result = await service.forgotPassword({ email: 'test@example.com' });
            expect(result.message).toEqual('Nếu email hợp lệ, một liên kết khôi phục đã được gửi đi.');
        });

        it('should create reset token and return message if user found', async () => {
            mockUsersService.findByEmailorUsername.mockResolvedValueOnce({ id: 1 });
            mockBcryptUtil.hashPassword.mockResolvedValueOnce('hash');
            
            const result = await service.forgotPassword({ email: 'test@example.com' });
            
            expect(prisma.passwordResetToken.create).toHaveBeenCalled();
            expect(result.message).toEqual('Nếu email hợp lệ, một liên kết khôi phục đã được gửi đi.');
            expect(result.debugToken).toBeDefined();
        });
    });

    describe('resetPassword', () => {
        const dto: any = { token: 'token', newPassword: 'new-password' };

        it('should throw TokenNotValidException if no valid token found', async () => {
            mockPrismaService.passwordResetToken.findMany.mockResolvedValueOnce([{ id: 1, tokenHash: 'hash', userId: 1 }]);
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(false);
            
            await expect(service.resetPassword(dto)).rejects.toThrow(TokenNotValidException);
        });

        it('should update password, mark token used, logout all, and return message', async () => {
            mockPrismaService.passwordResetToken.findMany.mockResolvedValueOnce([{ id: 1, tokenHash: 'hash', userId: 1 }]);
            mockBcryptUtil.comparePassword.mockResolvedValueOnce(true);
            mockBcryptUtil.hashPassword.mockResolvedValueOnce('newHash');
            
            const result = await service.resetPassword(dto);
            
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { passwordHash: 'newHash' }
            });
            expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { usedAt: expect.any(Date) }
            });
            expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
                where: { userId: 1, revokedAt: null },
                data: { revokedAt: expect.any(Date) }
            });
            expect(result).toEqual({ message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' });
        });
    });
});
