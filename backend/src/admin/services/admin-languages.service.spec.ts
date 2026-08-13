import { Test, TestingModule } from '@nestjs/testing';
import {
  DefaultLanguageCannotBeDeletedException,
  DefaultLanguageCannotBeDeactivatedException,
  DefaultLanguageCannotBeUnsetException,
  DefaultLanguageMustBeActiveException,
  LanguageEntity,
  LanguagesService,
  PrismaService,
} from '@app/core';
import { AdminLanguagesService } from './admin-languages.service';
import { AdminLanguageEntity } from '../entities';

describe('AdminLanguagesService', () => {
  let service: AdminLanguagesService;

  const mockPrismaService = {
    language: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },

    $transaction: jest.fn(),
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

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaService);
      }

      return callback;
    });

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
    it('should automatically make the first language default', async () => {
      mockPrismaService.language.findFirst.mockResolvedValueOnce(null);

      const dto = {
        code: 'vi',
        name: 'Tiếng Việt',
      };

      const createdLanguage = new LanguageEntity({
        id: 1,
        code: 'vi',
        name: 'Tiếng Việt',
        flag: null,
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockLanguagesService.create.mockResolvedValueOnce(createdLanguage);

      const result = await service.createLanguage(dto);

      expect(mockPrismaService.language.updateMany).toHaveBeenCalledWith({
        where: {
          isDefault: true,
          deletedAt: null,
        },
        data: {
          isDefault: false,
        },
      });

      expect(mockLanguagesService.create).toHaveBeenCalledWith(
        {
          code: 'vi',
          name: 'Tiếng Việt',
          isDefault: true,
          isActive: true,
        },
        expect.anything(),
      );

      expect(result.isDefault).toBe(true);
      expect(result.isActive).toBe(true);
    });

    it('should reject creating an inactive default language', async () => {
      mockPrismaService.language.findFirst.mockResolvedValueOnce({
        id: 1,
      });

      await expect(
        service.createLanguage({
          code: 'ja',
          name: 'Japanese',
          isDefault: true,
          isActive: false,
        }),
      ).rejects.toThrow(DefaultLanguageMustBeActiveException);

      expect(mockLanguagesService.create).not.toHaveBeenCalled();
    });

    it('should reset other default languages if isDefault is true', async () => {
      mockPrismaService.language.findFirst.mockResolvedValueOnce({
        id: 1,
      });

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
        where: { isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
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
    it('should not allow unsetting the current default directly', async () => {
      mockLanguagesService.findOne.mockResolvedValueOnce(
        new LanguageEntity({
          id: 1,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: null,
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      );

      await expect(
        service.updateLanguage(1, {
          isDefault: false,
        }),
      ).rejects.toThrow(DefaultLanguageCannotBeUnsetException);

      expect(mockLanguagesService.update).not.toHaveBeenCalled();
    });

    it('should not allow deactivating the current default language', async () => {
      mockLanguagesService.findOne.mockResolvedValueOnce(
        new LanguageEntity({
          id: 1,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: null,
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      );

      await expect(
        service.updateLanguage(1, {
          isActive: false,
        }),
      ).rejects.toThrow(DefaultLanguageCannotBeDeactivatedException);

      expect(mockLanguagesService.update).not.toHaveBeenCalled();
    });

    it('should switch default language atomically', async () => {
      const english = new LanguageEntity({
        id: 2,
        code: 'en',
        name: 'English',
        flag: '🇬🇧',
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const updatedEnglish = new LanguageEntity({
        ...english,
        isDefault: true,
      });

      mockLanguagesService.findOne.mockResolvedValueOnce(english);

      mockLanguagesService.update.mockResolvedValueOnce(updatedEnglish);

      const result = await service.updateLanguage(2, {
        isDefault: true,
      });

      expect(mockPrismaService.language.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            not: 2,
          },
          isDefault: true,
          deletedAt: null,
        },
        data: {
          isDefault: false,
        },
      });

      expect(mockLanguagesService.update).toHaveBeenCalledWith(
        2,
        {
          isDefault: true,
        },
        expect.anything(),
      );

      expect(result.isDefault).toBe(true);
    });
  });

  describe('deleteLanguage', () => {
    it('should not allow deleting the default language', async () => {
      mockLanguagesService.findOne.mockResolvedValueOnce(
        new LanguageEntity({
          id: 1,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: '🇻🇳',
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      );

      await expect(service.deleteLanguage(1)).rejects.toThrow(
        DefaultLanguageCannotBeDeletedException,
      );

      expect(mockLanguagesService.remove).not.toHaveBeenCalled();
    });

    it('should call languagesService.remove and return AdminLanguageEntity when deleting non-default', async () => {
      const nonDefaultLang = new LanguageEntity({
        id: 2,
        code: 'en',
        name: 'English',
        flag: '🇬🇧',
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const deletedLang = new LanguageEntity({
        ...nonDefaultLang,
        deletedAt: new Date(),
      });

      mockLanguagesService.findOne.mockResolvedValueOnce(nonDefaultLang);
      mockLanguagesService.remove.mockResolvedValueOnce(deletedLang);

      const result = await service.deleteLanguage(2);

      expect(mockLanguagesService.remove).toHaveBeenCalledWith(
        2,
        expect.anything(),
      );
      expect(result).toBeInstanceOf(AdminLanguageEntity);
    });
  });
});
