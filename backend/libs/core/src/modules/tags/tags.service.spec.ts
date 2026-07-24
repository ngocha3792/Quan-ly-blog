import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from './tags.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { TagNotFoundException, TagAlreadyExistsException } from '@app/core/common/exceptions';

describe('TagsService', () => {
    let service: TagsService;
    let prisma: PrismaService;

    const mockPrismaService = {
        tag: {
            findFirst: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
        },
        postTag: {
            groupBy: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TagsService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<TagsService>(TagsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should throw TagAlreadyExistsException if tag already exists', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce({ id: 1, name: 'test' });
            await expect(service.create({ name: 'test' })).rejects.toThrow(TagAlreadyExistsException);
        });

        it('should create a tag if it does not exist', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce(null);
            mockPrismaService.tag.create.mockResolvedValueOnce({ id: 1, name: 'test' });
            
            const result = await service.create({ name: ' test ' });
            
            expect(prisma.tag.create).toHaveBeenCalledWith({ data: { name: 'test' } });
            expect(result.id).toBe(1);
        });
    });

    describe('findAll', () => {
        it('should return paginated tags without filters', async () => {
            mockPrismaService.tag.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.tag.count.mockResolvedValueOnce(1);
            
            const result = await service.findAll({}, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.tag.findMany).toHaveBeenCalledWith({
                where: { deletedAt: null }, skip: 0, take: 10, orderBy: { createdAt: 'desc' }
            });
            expect(result.items.length).toBe(1);
        });

        it('should return paginated tags with search filter', async () => {
            mockPrismaService.tag.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.tag.count.mockResolvedValueOnce(1);
            
            await service.findAll({ search: 'test' }, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.tag.findMany).toHaveBeenCalledWith({
                where: { deletedAt: null, name: { contains: 'test', mode: 'insensitive' } },
                skip: 0, take: 10, orderBy: { createdAt: 'desc' }
            });
        });
    });

    describe('findOne', () => {
        it('should throw TagNotFoundException if tag not found', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce(null);
            await expect(service.findOne(999)).rejects.toThrow(TagNotFoundException);
        });

        it('should return tag if found', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce({ id: 1 });
            const result = await service.findOne(1);
            expect(result.id).toBe(1);
        });
    });

    describe('update', () => {
        it('should throw TagNotFoundException if tag not found', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce(null);
            await expect(service.update(999, {} as any)).rejects.toThrow(TagNotFoundException);
        });

        it('should throw TagAlreadyExistsException if new name already exists in another tag', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce({ id: 1 }); // findOne
            mockPrismaService.tag.findFirst.mockResolvedValueOnce({ id: 2 }); // existing tag
            
            await expect(service.update(1, { name: 'new' })).rejects.toThrow(TagAlreadyExistsException);
        });

        it('should update the tag successfully', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce({ id: 1 }); // findOne
            mockPrismaService.tag.findFirst.mockResolvedValueOnce(null); // existing tag
            mockPrismaService.tag.update.mockResolvedValueOnce({ id: 1, name: 'new' });
            
            const result = await service.update(1, { name: ' new ' });
            
            expect(prisma.tag.update).toHaveBeenCalledWith({
                where: { id: 1 }, data: { name: 'new' }
            });
            expect(result.name).toBe('new');
        });
    });

    describe('remove', () => {
        it('should throw TagNotFoundException if tag not found', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce(null);
            await expect(service.remove(999)).rejects.toThrow(TagNotFoundException);
        });

        it('should delete and return tag', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.tag.update.mockResolvedValueOnce({ id: 1 });
            
            const result = await service.remove(1);
            
            expect(prisma.tag.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { deletedAt: expect.any(Date) } });
            expect(result.id).toBe(1);
        });
    });


});
