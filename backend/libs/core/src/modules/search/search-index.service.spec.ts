import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { SearchIndexService } from './search-index.service';

describe('SearchIndexService', () => {
  let service: SearchIndexService;

  const mockPrismaService = {
    post: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    searchDocument: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const eligiblePost = {
    id: 1,
    languageId: 4,
    status: PostStatus.PUBLISH,
    deletedAt: null,
    title: 'Tiêu đề',
    content: 'Nội dung',
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    language: { isActive: true, deletedAt: null },
    author: { status: UserStatus.ACTIVE, deletedAt: null },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchIndexService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SearchIndexService>(SearchIndexService);
  });

  describe('syncSearchIndex', () => {
    it('upserts the search document when the post is PUBLISH and fully eligible', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(eligiblePost);

      await service.syncSearchIndex(1);

      expect(mockPrismaService.searchDocument.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { postId: 1 },
          create: expect.objectContaining({
            postId: 1,
            titleText: 'Tiêu đề',
            contentText: 'Nội dung',
          }),
        }),
      );
      expect(mockPrismaService.searchDocument.deleteMany).not.toHaveBeenCalled();
    });

    it('removes the document when the post no longer exists', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await service.syncSearchIndex(99);

      expect(mockPrismaService.searchDocument.deleteMany).toHaveBeenCalledWith({
        where: { postId: 99 },
      });
      expect(mockPrismaService.searchDocument.upsert).not.toHaveBeenCalled();
    });

    it.each([
      ['status is DRAFT', { ...eligiblePost, status: PostStatus.DRAFT }],
      ['status is PENDING_REVIEW', { ...eligiblePost, status: PostStatus.PENDING_REVIEW }],
      ['status is REJECT', { ...eligiblePost, status: PostStatus.REJECT }],
      ['soft-deleted', { ...eligiblePost, deletedAt: new Date() }],
      [
        'language is inactive',
        { ...eligiblePost, language: { isActive: false, deletedAt: null } },
      ],
      [
        'language is soft-deleted',
        { ...eligiblePost, language: { isActive: true, deletedAt: new Date() } },
      ],
      [
        'author is locked',
        { ...eligiblePost, author: { status: UserStatus.LOCKED, deletedAt: null } },
      ],
      [
        'author is soft-deleted',
        { ...eligiblePost, author: { status: UserStatus.ACTIVE, deletedAt: new Date() } },
      ],
    ])('removes the document when %s', async (_label, post) => {
      mockPrismaService.post.findUnique.mockResolvedValue(post);

      await service.syncSearchIndex(1);

      expect(mockPrismaService.searchDocument.deleteMany).toHaveBeenCalledWith({
        where: { postId: 1 },
      });
      expect(mockPrismaService.searchDocument.upsert).not.toHaveBeenCalled();
    });
  });

  describe('syncSearchIndexGroup', () => {
    it('syncs every post in the group resolved from a translation id', async () => {
      mockPrismaService.post.findUnique
        .mockResolvedValueOnce({ id: 12, parentPostId: 10 })
        .mockResolvedValueOnce(eligiblePost)
        .mockResolvedValueOnce({ ...eligiblePost, id: 12 });

      mockPrismaService.post.findMany.mockResolvedValue([
        { id: 10 },
        { id: 12 },
      ]);

      await service.syncSearchIndexGroup(12);

      expect(mockPrismaService.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { id: 10, parentPostId: null },
              { parentPostId: 10 },
            ],
          },
        }),
      );
      expect(mockPrismaService.searchDocument.upsert).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the anchor post cannot be found', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await service.syncSearchIndexGroup(999);

      expect(mockPrismaService.searchDocument.deleteMany).toHaveBeenCalledWith({
        where: { postId: 999 },
      });
      expect(mockPrismaService.post.findMany).not.toHaveBeenCalled();
    });
  });
});
