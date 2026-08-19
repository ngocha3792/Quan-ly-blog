import { Test, TestingModule } from '@nestjs/testing';
import { LanguagesService } from './languages.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';

describe('LanguagesService', () => {
  let service: LanguagesService;

  const mockPrismaService = {
    language: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguagesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LanguagesService>(LanguagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveIdByCode', () => {
    it('should return id of active non-deleted language', async () => {
      mockPrismaService.language.findFirst.mockResolvedValueOnce({
        id: 1,
      });

      const result = await service.getActiveIdByCode('VI');

      expect(mockPrismaService.language.findFirst).toHaveBeenCalledWith({
        where: {
          code: 'vi',
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      expect(result).toBe(1);
    });

    it('should return undefined when language is inactive', async () => {
      mockPrismaService.language.findFirst.mockResolvedValueOnce(null);

      const result = await service.getActiveIdByCode('ja');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty language code', async () => {
      const result = await service.getActiveIdByCode('   ');

      expect(result).toBeUndefined();

      expect(mockPrismaService.language.findFirst).not.toHaveBeenCalled();
    });
  });
});
