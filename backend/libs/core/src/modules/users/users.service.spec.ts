import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { BcryptUtil } from '@app/core/common/utils';
import { EmailAlreadyExistsException, UsernameAlreadyExistsException, UserNotFoundException } from '@app/core/common/exceptions';

describe('UsersService', () => {
    let service: UsersService;
    let prisma: PrismaService;
    let bcryptUtil: BcryptUtil;

    const mockPrismaService = {
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
    };

    const mockBcryptUtil = {
        hashPassword: jest.fn().mockResolvedValue('hashedPassword'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: BcryptUtil, useValue: mockBcryptUtil },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        prisma = module.get<PrismaService>(PrismaService);
        bcryptUtil = module.get<BcryptUtil>(BcryptUtil);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        const createDto = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
        };

        it('should throw EmailAlreadyExistsException if email exists', async () => {
            mockPrismaService.user.findFirst.mockResolvedValueOnce({ email: 'test@example.com' });
            
            await expect(service.create(createDto)).rejects.toThrow(EmailAlreadyExistsException);
        });

        it('should create a new user successfully', async () => {
            mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
            mockPrismaService.user.create.mockResolvedValueOnce({
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                passwordHash: 'hashedPassword',
                role: 'NORMAL',
                status: 'ACTIVE',
            });

            const result = await service.create(createDto);
            expect(result.username).toEqual('testuser');
            expect(bcryptUtil.hashPassword).toHaveBeenCalledWith('password123');
        });
    });

    describe('findById', () => {
        it('should return a user if found', async () => {
            mockPrismaService.user.findFirst.mockResolvedValueOnce({ id: 1, username: 'testuser' });
            const result = await service.findById(1);
            expect(result?.username).toEqual('testuser');
        });
    });

    describe('update', () => {
        it('should throw UserNotFoundException if user not found', async () => {
            mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
            
            await expect(service.update(999, {})).rejects.toThrow(UserNotFoundException);
        });
    });
});
