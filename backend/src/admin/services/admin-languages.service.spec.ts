import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, LanguagesService, LanguageEntity } from '@app/core';
import { AdminLanguagesService } from './admin-languages.service';
import { AdminLanguageEntity } from '../entities';

describe('AdminLanguagesService', () => {
  let service: AdminLanguagesService;

  const mockPrismaService = {
    language: {
      updateMany: jest.fn(),
    },
  };

  const mockLanguagesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminLanguagesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: LanguagesService,
          useValue: mockLanguagesService,
        },
      ],
    }).compile();

    service = module.get<AdminLanguagesService>(AdminLanguagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLanguage', () => {
    it('should reset other default languages if isDefault is true', async () => {
      const dto = {
        code: 'ja',
        name: 'Japanese',
        isDefault: true,
        isActive: true,
      };

      const createdLang = new LanguageEntity({
        id: 3,
        code: 'ja',
        name: 'Japanese',
        flag: null,
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockLanguagesService.create.mockResolvedValueOnce(createdLang);

      const result = await service.createLanguage(dto);

      expect(mockPrismaService.language.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      expect(mockLanguagesService.create).toHaveBeenCalledWith(dto);
      expect(result).toBeInstanceOf(AdminLanguageEntity);
      expect(result.code).toBe('ja');
    });
  });

  describe('findAllLanguages', () => {
    it('should return mapped AdminLanguageEntity array', async () => {
      const mockLangs = [
        new LanguageEntity({
          id: 1,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: 'VN',
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      ];

      mockLanguagesService.findAll.mockResolvedValueOnce(mockLangs);

      const result = await service.findAllLanguages();

      expect(mockLanguagesService.findAll).toHaveBeenCalled();
      expect(result[0]).toBeInstanceOf(AdminLanguageEntity);
      expect(result[0].code).toBe('vi');
    });
  });

  describe('findOneLanguage', () => {
    it('should return AdminLanguageEntity when found', async () => {
      const mockLang = new LanguageEntity({
        id: 1,
        code: 'vi',
        name: 'Tiếng Việt',
        flag: 'VN',
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockLanguagesService.findOne.mockResolvedValueOnce(mockLang);

      const result = await service.findOneLanguage(1);

      expect(mockLanguagesService.findOne).toHaveBeenCalledWith(1);
      expect(result).toBeInstanceOf(AdminLanguageEntity);
      expect(result.id).toBe(1);
    });
  });

  describe('updateLanguage', () => {
    it('should reset other default languages if isDefault is set to true', async () => {
      const dto = { isDefault: true };
      const updatedLang = new LanguageEntity({
        id: 2,
        code: 'en',
        name: 'English',
        flag: 'US',
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockLanguagesService.update.mockResolvedValueOnce(updatedLang);

      const result = await service.updateLanguage(2, dto);

      expect(mockPrismaService.language.updateMany).toHaveBeenCalledWith({
        where: { id: { not: 2 }, isDefault: true },
        data: { isDefault: false },
      });
      expect(mockLanguagesService.update).toHaveBeenCalledWith(2, dto);
      expect(result).toBeInstanceOf(AdminLanguageEntity);
    });
  });

  describe('deleteLanguage', () => {
    it('should call languagesService.remove and return AdminLanguageEntity', async () => {
      const deletedLang = new LanguageEntity({
        id: 1,
        code: 'vi',
        name: 'Tiếng Việt',
        flag: 'VN',
        isDefault: false,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      });

      mockLanguagesService.remove.mockResolvedValueOnce(deletedLang);

      const result = await service.deleteLanguage(1);

      expect(mockLanguagesService.remove).toHaveBeenCalledWith(1);
      expect(result).toBeInstanceOf(AdminLanguageEntity);
    });
  });
});
