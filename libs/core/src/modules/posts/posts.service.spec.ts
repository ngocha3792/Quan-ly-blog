import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostNotFoundException, ExistActionNotAllowedException } from '@app/core/common/exceptions';

describe('PostsService', () => {
    let service: PostsService;
    let prisma: PrismaService;

    const mockPrismaService = {
        post: {
            findFirst: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
        },
        tag: {
            findMany: jest.fn(),
            createMany: jest.fn(),
            findFirst: jest.fn(),
        },
        postLike: {
            findUnique: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
        },
        postBookmark: {
            findUnique: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PostsService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<PostsService>(PostsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        const authorId = 1;
        
        it('should create a post without tags', async () => {
            const createDto: any = { title: 'Test Post', content: 'Content' };
            mockPrismaService.post.create.mockResolvedValueOnce({ id: 1, ...createDto, authorId });
            
            const result = await service.create(authorId, createDto);
            
            expect(prisma.post.create).toHaveBeenCalledWith({
                data: { title: 'Test Post', content: 'Content', authorId, status: 'DRAFT' }
            });
            expect(result.id).toBe(1);
        });

        it('should resolve tags and create a post with postTags', async () => {
            const createDto: any = { title: 'Test Post', tagIds: [1], tagNames: ['new-tag'] };
            
            // resolveTags logic:
            mockPrismaService.tag.findMany
                .mockResolvedValueOnce([]) // existing tags for 'new-tag'
                .mockResolvedValueOnce([{ id: 2, name: 'new-tag' }]); // newly created tags
                
            mockPrismaService.tag.createMany.mockResolvedValueOnce({ count: 1 });
            mockPrismaService.post.create.mockResolvedValueOnce({ id: 1 });
            
            const result = await service.create(authorId, createDto);
            
            expect(prisma.tag.createMany).toHaveBeenCalledWith({
                data: [{ name: 'new-tag' }],
                skipDuplicates: true
            });
            expect(prisma.post.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    title: 'Test Post',
                    postTags: { create: [{ tagId: 1 }, { tagId: 2 }] }
                })
            });
            expect(result.id).toBe(1);
        });
    });

    describe('findAll', () => {
        it('should return paginated posts without filters', async () => {
            mockPrismaService.post.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.post.count.mockResolvedValueOnce(1);
            
            const result = await service.findAll({}, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.post.findMany).toHaveBeenCalledWith({
                where: { deletedAt: null },
                skip: 0, take: 10, orderBy: { createdAt: 'desc' }
            });
            expect(result.items.length).toBe(1);
        });

        it('should apply various filters including tagName', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce({ id: 99 });
            mockPrismaService.post.findMany.mockResolvedValueOnce([{ id: 1 }]);
            mockPrismaService.post.count.mockResolvedValueOnce(1);
            
            const query: any = { search: 'Test', tagName: 'tag', bookmarkedByUserId: 1 };
            await service.findAll(query, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.post.findMany).toHaveBeenCalledWith({
                where: expect.objectContaining({
                    title: { contains: 'Test', mode: 'insensitive' },
                    postTags: { some: { tagId: 99 } },
                    postBookmarks: { some: { userId: 1 } }
                }),
                skip: 0, take: 10, orderBy: { createdAt: 'desc' }
            });
        });
        
        it('should handle tagName not found by setting impossible condition', async () => {
            mockPrismaService.tag.findFirst.mockResolvedValueOnce(null); // Tag not found
            mockPrismaService.post.findMany.mockResolvedValueOnce([]);
            mockPrismaService.post.count.mockResolvedValueOnce(0);
            
            const query: any = { tagName: 'missing' };
            await service.findAll(query, { skip: 0, take: 10, page: 1 });
            
            expect(prisma.post.findMany).toHaveBeenCalledWith({
                where: expect.objectContaining({ id: -1 }),
                skip: 0, take: 10, orderBy: { createdAt: 'desc' }
            });
        });
    });

    describe('findOne', () => {
        it('should throw PostNotFoundException if post not found', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce(null);
            await expect(service.findOne(999)).rejects.toThrow(PostNotFoundException);
        });

        it('should return post if found', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            const result = await service.findOne(1);
            expect(result.id).toBe(1);
        });
    });

    describe('update', () => {
        it('should update a post and resolve tags', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.post.update.mockResolvedValueOnce({ id: 1 });
            
            const updateDto: any = { title: 'Updated', tagIds: [1] };
            
            await service.update(1, updateDto);
            
            expect(prisma.post.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    title: 'Updated',
                    postTags: { deleteMany: {}, create: [{ tagId: 1 }] }
                })
            });
        });
    });

    describe('remove', () => {
        it('should soft delete post', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.post.update.mockResolvedValueOnce({ id: 1 });
            
            await service.remove(1);
            
            expect(prisma.post.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { deletedAt: expect.any(Date) }
            });
        });
    });

    describe('likePost', () => {
        it('should throw ExistActionNotAllowedException if already liked', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.postLike.findUnique.mockResolvedValueOnce({ postId: 1, userId: 1 });
            
            await expect(service.likePost(1, 1)).rejects.toThrow(ExistActionNotAllowedException);
        });

        it('should create postLike if not liked', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.postLike.findUnique.mockResolvedValueOnce(null);
            mockPrismaService.postLike.create.mockResolvedValueOnce({ postId: 1, userId: 1 });
            
            await service.likePost(1, 1);
            
            expect(prisma.postLike.create).toHaveBeenCalledWith({ data: { postId: 1, userId: 1 } });
        });
    });

    describe('unlikePost', () => {
        it('should throw ExistActionNotAllowedException if not liked', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.postLike.findUnique.mockResolvedValueOnce(null);
            
            await expect(service.unlikePost(1, 1)).rejects.toThrow(ExistActionNotAllowedException);
        });

        it('should delete postLike if liked', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.postLike.findUnique.mockResolvedValueOnce({ postId: 1, userId: 1 });
            
            await service.unlikePost(1, 1);
            
            expect(prisma.postLike.delete).toHaveBeenCalledWith({ where: { postId_userId: { postId: 1, userId: 1 } } });
        });
    });

    describe('bookmarkPost', () => {
        it('should throw ExistActionNotAllowedException if already bookmarked', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.postBookmark.findUnique.mockResolvedValueOnce({ postId: 1, userId: 1 });
            
            await expect(service.bookmarkPost(1, 1)).rejects.toThrow(ExistActionNotAllowedException);
        });

        it('should create postBookmark if not bookmarked', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.postBookmark.findUnique.mockResolvedValueOnce(null);
            mockPrismaService.postBookmark.create.mockResolvedValueOnce({ postId: 1, userId: 1 });
            
            await service.bookmarkPost(1, 1);
            
            expect(prisma.postBookmark.create).toHaveBeenCalledWith({ data: { postId: 1, userId: 1 } });
        });
    });

    describe('unbookmarkPost', () => {
        it('should throw ExistActionNotAllowedException if not bookmarked', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.postBookmark.findUnique.mockResolvedValueOnce(null);
            
            await expect(service.unbookmarkPost(1, 1)).rejects.toThrow(ExistActionNotAllowedException);
        });

        it('should delete postBookmark if bookmarked', async () => {
            mockPrismaService.post.findFirst.mockResolvedValueOnce({ id: 1 });
            mockPrismaService.postBookmark.findUnique.mockResolvedValueOnce({ postId: 1, userId: 1 });
            
            await service.unbookmarkPost(1, 1);
            
            expect(prisma.postBookmark.delete).toHaveBeenCalledWith({ where: { postId_userId: { postId: 1, userId: 1 } } });
        });
    });
});
