import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { ReportNotFoundException } from '@app/core/common/exceptions';
import { ReportStatus, ReportTargetType } from '@prisma/client';

describe('ReportsService', () => {
    let service: ReportsService;
    let prisma: PrismaService;

    const mockPrismaService = {
        report: {
            findFirst: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            delete: jest.fn(),
        },
        post: {
            update: jest.fn().mockResolvedValue({}),
        },
        comment: {
            update: jest.fn().mockResolvedValue({}),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportsService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<ReportsService>(ReportsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a report', async () => {
            const createDto: any = { targetType: ReportTargetType.POST, postId: 1, reason: 'Spam' };
            mockPrismaService.report.create.mockResolvedValueOnce({ id: 1, reporterId: 1, ...createDto });
            
            const result = await service.create(1, createDto);
            
            expect(prisma.report.create).toHaveBeenCalledWith({
                data: { ...createDto, reporterId: 1 }
            });
            expect(result.id).toBe(1);
        });
    });

    describe('findAll', () => {
        it('should return paginated reports without filters', async () => {
            mockPrismaService.report.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.report.count.mockResolvedValueOnce(1);
            
            const result = await service.findAll({}, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.report.findMany).toHaveBeenCalledWith({
                where: {}, skip: 0, take: 10, orderBy: { createdAt: 'desc' }
            });
            expect(result.items.length).toBe(1);
        });

        it('should apply filters correctly', async () => {
            mockPrismaService.report.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.report.count.mockResolvedValueOnce(1);
            
            const query: any = { targetType: ReportTargetType.COMMENT, status: ReportStatus.PENDING, reason: 'Spam', reporterId: 1, postId: 1, commentId: 2 };
            await service.findAll(query, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.report.findMany).toHaveBeenCalledWith({
                where: query, skip: 0, take: 10, orderBy: { createdAt: 'desc' }
            });
        });
    });

    describe('findOne', () => {
        it('should throw ReportNotFoundException if not found', async () => {
            mockPrismaService.report.findUnique.mockResolvedValueOnce(null);
            await expect(service.findOne(999)).rejects.toThrow(ReportNotFoundException);
        });

        it('should return the report if found', async () => {
            mockPrismaService.report.findUnique.mockResolvedValueOnce({ id: 1 });
            const result = await service.findOne(1);
            expect(result.id).toBe(1);
        });
    });

    describe('update', () => {
        it('should throw ReportNotFoundException if not found', async () => {
            mockPrismaService.report.findUnique.mockResolvedValueOnce(null);
            await expect(service.update(999, 1, {} as any)).rejects.toThrow(ReportNotFoundException);
        });

        it('should update the report without soft deleting target if not RESOLVED', async () => {
            mockPrismaService.report.findUnique.mockResolvedValueOnce({ id: 1, status: ReportStatus.PENDING });
            mockPrismaService.report.update.mockResolvedValueOnce({ id: 1, status: ReportStatus.REJECTED });
            
            const result = await service.update(1, 2, { status: ReportStatus.REJECTED } as any);
            
            expect(prisma.report.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { status: ReportStatus.REJECTED, reviewedById: 2, reviewedAt: expect.any(Date) }
            });
            expect(prisma.post.update).not.toHaveBeenCalled();
            expect(prisma.comment.update).not.toHaveBeenCalled();
            expect(result.id).toBe(1);
        });

        it('should soft delete post if RESOLVED and targetType is POST', async () => {
            mockPrismaService.report.findUnique.mockResolvedValueOnce({ id: 1, status: ReportStatus.PENDING, targetType: ReportTargetType.POST, postId: 1 });
            mockPrismaService.report.update.mockResolvedValueOnce({ id: 1, status: ReportStatus.RESOLVED });
            
            await service.update(1, 2, { status: ReportStatus.RESOLVED } as any);
            
            expect(prisma.post.update).toHaveBeenCalledWith({
                where: { id: 1 }, data: { deletedAt: expect.any(Date) }
            });
        });

        it('should soft delete comment if RESOLVED and targetType is COMMENT', async () => {
            mockPrismaService.report.findUnique.mockResolvedValueOnce({ id: 1, status: ReportStatus.PENDING, targetType: ReportTargetType.COMMENT, commentId: 2 });
            mockPrismaService.report.update.mockResolvedValueOnce({ id: 1, status: ReportStatus.RESOLVED });
            
            await service.update(1, 2, { status: ReportStatus.RESOLVED } as any);
            
            expect(prisma.comment.update).toHaveBeenCalledWith({
                where: { id: 2 }, data: { deletedAt: expect.any(Date) }
            });
        });
    });

    describe('remove', () => {
        it('should throw ReportNotFoundException if not found', async () => {
            mockPrismaService.report.findUnique.mockResolvedValueOnce(null);
            await expect(service.remove(999)).rejects.toThrow(ReportNotFoundException);
        });

        it('should delete report if found', async () => {
            mockPrismaService.report.findUnique.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.report.delete.mockResolvedValueOnce({ id: 1 });
            
            const result = await service.remove(1);
            
            expect(prisma.report.delete).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result.id).toBe(1);
        });
    });
});
