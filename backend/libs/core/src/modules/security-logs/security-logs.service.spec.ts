import { Test, TestingModule } from '@nestjs/testing';
import { SecurityLogsService } from './security-logs.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('SecurityLogsService', () => {
    let service: SecurityLogsService;
    let prisma: PrismaService;

    const mockPrismaService = {
        securityLog: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SecurityLogsService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<SecurityLogsService>(SecurityLogsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a security log', async () => {
            const createDto: any = { userId: 1, ipAddress: '127.0.0.1', action: 'LOGIN', userAgent: 'Browser' };
            mockPrismaService.securityLog.create.mockResolvedValueOnce({ id: 1, ...createDto });
            
            const result = await service.create(createDto);
            
            expect(prisma.securityLog.create).toHaveBeenCalledWith({ data: createDto });
            expect(result.id).toBe(1);
        });
    });

    describe('findAll', () => {
        it('should return paginated security logs without filters', async () => {
            mockPrismaService.securityLog.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.securityLog.count.mockResolvedValueOnce(1);
            
            const result = await service.findAll({}, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.securityLog.findMany).toHaveBeenCalledWith({
                where: {}, skip: 0, take: 10, orderBy: { createdAt: 'desc' }, include: expect.any(Object)
            });
            expect(result.items.length).toBe(1);
        });

        it('should apply filters correctly', async () => {
            mockPrismaService.securityLog.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.securityLog.count.mockResolvedValueOnce(1);
            
            const query: any = { userId: 1, action: 'LOGIN', ipAddress: '127.0.0.1' };
            await service.findAll(query, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.securityLog.findMany).toHaveBeenCalledWith({
                where: {
                    userId: 1,
                    action: { contains: 'LOGIN', mode: 'insensitive' },
                    ipAddress: { contains: '127.0.0.1', mode: 'insensitive' }
                },
                skip: 0, take: 10, orderBy: { createdAt: 'desc' }, include: expect.any(Object)
            });
        });
    });

    describe('findOne', () => {
        it('should throw NotFoundException if log not found', async () => {
            mockPrismaService.securityLog.findUnique.mockResolvedValueOnce(null);
            await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
        });

        it('should return the log if found', async () => {
            mockPrismaService.securityLog.findUnique.mockResolvedValueOnce({ id: 1 });
            const result = await service.findOne(1);
            expect(result.id).toBe(1);
        });
    });
});
