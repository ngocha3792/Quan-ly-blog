import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CategoryAlreadyExistsException, CategoryNotFoundException } from '@app/core/common/exceptions';

describe('CategoriesService', () => {
    let service: CategoriesService;
    let prisma: PrismaService;

    const mockPrismaService = {
        category: {
            findFirst: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CategoriesService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<CategoriesService>(CategoriesService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        const createDto: any = { name: 'Technology', languageId: 1 };

        it('should throw CategoryAlreadyExistsException if category exists', async () => {
            mockPrismaService.category.findFirst.mockResolvedValueOnce({ id: 1, name: 'Technology' });
            await expect(service.create(createDto)).rejects.toThrow(CategoryAlreadyExistsException);
        });

        it('should create a new category', async () => {
            mockPrismaService.category.findFirst.mockResolvedValueOnce(null);
            mockPrismaService.category.create.mockResolvedValueOnce({ id: 1, ...createDto });
            
            const result = await service.create(createDto);
            
            expect(prisma.category.create).toHaveBeenCalledWith({ data: createDto });
            expect(result.id).toBe(1);
            expect(result.name).toBe('Technology');
        });
    });

    describe('findAll', () => {
        it('should return paginated categories without filters', async () => {
            mockPrismaService.category.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.category.count.mockResolvedValueOnce(1);
            
            const result = await service.findAll({}, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.category.findMany).toHaveBeenCalledWith({
                where: { deletedAt: null },
                skip: 0,
                take: 10,
                orderBy: { createdAt: 'desc' }
            });
            expect(result.items.length).toBe(1);
        });

        it('should return paginated categories with search and languageId filters', async () => {
            mockPrismaService.category.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.category.count.mockResolvedValueOnce(1);
            
            const query: any = { search: 'Tech', languageId: 1 };
            const result = await service.findAll(query, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.category.findMany).toHaveBeenCalledWith({
                where: {
                    deletedAt: null,
                    name: { contains: 'Tech', mode: 'insensitive' },
                    languageId: 1
                },
                skip: 0,
                take: 10,
                orderBy: { createdAt: 'desc' }
            });
            expect(result.meta.totalItems).toBe(1);
        });
    });

    describe('findOne', () => {
        it('should throw CategoryNotFoundException if category not found', async () => {
            mockPrismaService.category.findFirst.mockResolvedValueOnce(null);
            await expect(service.findOne(999)).rejects.toThrow(CategoryNotFoundException);
        });

        it('should return category if found', async () => {
            mockPrismaService.category.findFirst.mockResolvedValueOnce({ id: 1 });
            const result = await service.findOne(1);
            expect(result.id).toBe(1);
        });
    });

    describe('update', () => {
        it('should throw CategoryNotFoundException if category not found', async () => {
            mockPrismaService.category.findFirst.mockResolvedValueOnce(null);
            await expect(service.update(999, {} as any)).rejects.toThrow(CategoryNotFoundException);
        });

        it('should throw CategoryAlreadyExistsException if updating to existing name/languageId', async () => {
            mockPrismaService.category.findFirst
                .mockResolvedValueOnce({ id: 1, name: 'Old', languageId: 1 }) // findOne
                .mockResolvedValueOnce({ id: 2 }); // existingCategory check
                
            await expect(service.update(1, { name: 'New' } as any)).rejects.toThrow(CategoryAlreadyExistsException);
        });

        it('should update successfully with name/languageId change', async () => {
            mockPrismaService.category.findFirst
                .mockResolvedValueOnce({ id: 1, name: 'Old', languageId: 1 }) // findOne
                .mockResolvedValueOnce(null); // existingCategory check
                
            mockPrismaService.category.update.mockResolvedValueOnce({ id: 1, name: 'New' });
            
            const result = await service.update(1, { name: 'New' } as any);
            
            expect(prisma.category.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { name: 'New' }
            });
            expect(result.name).toBe('New');
        });

        it('should update successfully without name/languageId change', async () => {
            mockPrismaService.category.findFirst.mockResolvedValueOnce({ id: 1, name: 'Old', languageId: 1 });
            mockPrismaService.category.update.mockResolvedValueOnce({ id: 1, description: 'Desc' });
            
            const updateDto: any = { description: 'Desc' };
            const result = await service.update(1, updateDto);
            
            expect(prisma.category.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: updateDto
            });
            expect(result.id).toBe(1);
        });
    });

    describe('remove', () => {
        it('should throw CategoryNotFoundException if category not found', async () => {
            mockPrismaService.category.findFirst.mockResolvedValueOnce(null);
            await expect(service.remove(999)).rejects.toThrow(CategoryNotFoundException);
        });

        it('should soft delete category if found', async () => {
            mockPrismaService.category.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.category.update.mockResolvedValueOnce({ id: 1, deletedAt: new Date() });
            
            const result = await service.remove(1);
            
            expect(prisma.category.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { deletedAt: expect.any(Date) }
            });
            expect(result.id).toBe(1);
        });
    });
});
