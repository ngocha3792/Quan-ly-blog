import { Test, TestingModule } from '@nestjs/testing';
import { BlogOwnerRequestsService } from './blog-owner-requests.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { BlogOwnerRequestNotFoundException, ExistActionNotAllowedException } from '@app/core/common/exceptions';
import { BlogOwnerRequestStatus } from '@prisma/client';

describe('BlogOwnerRequestsService', () => {
    let service: BlogOwnerRequestsService;
    let prisma: PrismaService;

    const mockPrismaService = {
        blogOwnerRequest: {
            findFirst: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        user: {
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlogOwnerRequestsService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<BlogOwnerRequestsService>(BlogOwnerRequestsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        const createDto: any = { content: 'test content' };
        const userId = 1;

        it('should throw ExistActionNotAllowedException if user has a pending request', async () => {
            mockPrismaService.blogOwnerRequest.findFirst.mockResolvedValueOnce({ id: 1, status: BlogOwnerRequestStatus.PENDING });

            await expect(service.create(userId, createDto)).rejects.toThrow(ExistActionNotAllowedException);
        });

        it('should create a new request successfully if no pending requests exist', async () => {
            mockPrismaService.blogOwnerRequest.findFirst.mockResolvedValueOnce(null);
            const createdRequest = { id: 1, userId, content: 'test content', status: BlogOwnerRequestStatus.PENDING };
            mockPrismaService.blogOwnerRequest.create.mockResolvedValueOnce(createdRequest);

            const result = await service.create(userId, createDto);

            expect(prisma.blogOwnerRequest.create).toHaveBeenCalledWith({
                data: {
                    ...createDto,
                    userId,
                    status: BlogOwnerRequestStatus.PENDING,
                }
            });
            expect(result.id).toEqual(1);
            expect(result.status).toEqual(BlogOwnerRequestStatus.PENDING);
        });
    });

    describe('findAll', () => {
        it('should return a paginated result', async () => {
            const query: any = { userId: 1, status: BlogOwnerRequestStatus.PENDING };
            const paginationParams: any = { skip: 0, take: 10, page: 1 };
            const requests = [{ id: 1, userId: 1, status: BlogOwnerRequestStatus.PENDING }];

            mockPrismaService.blogOwnerRequest.findMany.mockResolvedValueOnce(requests);
            mockPrismaService.blogOwnerRequest.count.mockResolvedValueOnce(1);

            const result = await service.findAll(query, paginationParams);

            expect(prisma.blogOwnerRequest.findMany).toHaveBeenCalledWith({
                where: { userId: 1, status: BlogOwnerRequestStatus.PENDING },
                skip: 0,
                take: 10,
                orderBy: { createdAt: 'desc' }
            });
            expect(result.items.length).toBe(1);
            expect(result.meta.totalItems).toBe(1);
            expect(result.meta.currentPage).toBe(1);
        });
    });

    describe('findOne', () => {
        it('should throw BlogOwnerRequestNotFoundException if request not found', async () => {
            mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce(null);
            await expect(service.findOne(999)).rejects.toThrow(BlogOwnerRequestNotFoundException);
        });

        it('should return the request entity if found', async () => {
            mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce({ id: 1 });
            const result = await service.findOne(1);
            expect(result.id).toBe(1);
        });
    });

    describe('update', () => {
        const updateDto: any = { status: BlogOwnerRequestStatus.APPROVED };
        const reviewerId = 2;

        it('should throw BlogOwnerRequestNotFoundException if request not found', async () => {
            mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce(null);
            await expect(service.update(999, reviewerId, updateDto)).rejects.toThrow(BlogOwnerRequestNotFoundException);
        });

        it('should update request if status is not APPROVED', async () => {
            const existingRequest = { id: 1, userId: 1, status: BlogOwnerRequestStatus.PENDING };
            mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce(existingRequest);
            const updatedRequest = { id: 1, userId: 1, status: BlogOwnerRequestStatus.REJECTED };
            mockPrismaService.blogOwnerRequest.update.mockResolvedValueOnce(updatedRequest);

            const result = await service.update(1, reviewerId, { status: BlogOwnerRequestStatus.REJECTED } as any);

            expect(prisma.blogOwnerRequest.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { status: BlogOwnerRequestStatus.REJECTED, reviewedById: reviewerId, reviewedAt: expect.any(Date) }
            });
            expect(result.status).toEqual(BlogOwnerRequestStatus.REJECTED);
        });

        it('should update request if status changed to APPROVED', async () => {
            const existingRequest = { id: 1, userId: 1, status: BlogOwnerRequestStatus.PENDING };
            mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce(existingRequest);
            const updatedRequest = { id: 1, userId: 1, status: BlogOwnerRequestStatus.APPROVED };
            mockPrismaService.blogOwnerRequest.update.mockResolvedValueOnce(updatedRequest);

            const result = await service.update(1, reviewerId, updateDto);

            expect(prisma.blogOwnerRequest.update).toHaveBeenCalled();
            expect(result.status).toEqual(BlogOwnerRequestStatus.APPROVED);
        });
    });

    describe('remove', () => {
        it('should throw BlogOwnerRequestNotFoundException if request not found', async () => {
            mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce(null);
            await expect(service.remove(999)).rejects.toThrow(BlogOwnerRequestNotFoundException);
        });

        it('should delete and return the request if found', async () => {
            mockPrismaService.blogOwnerRequest.findUnique.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.blogOwnerRequest.delete.mockResolvedValueOnce({ id: 1 });

            const result = await service.remove(1);

            expect(prisma.blogOwnerRequest.delete).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result.id).toEqual(1);
        });
    });
});
