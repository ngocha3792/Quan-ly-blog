import { Test, TestingModule } from '@nestjs/testing';
import { LanguagesService } from '@app/core';
import { LanguagesPublicService } from './languages-public.service';

describe('LanguagesPublicService', () => {
  let service: LanguagesPublicService;
  let languagesService: {
    findAllActive: jest.Mock;
  };

  beforeEach(async () => {
    languagesService = {
      findAllActive: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguagesPublicService,
        {
          provide: LanguagesService,
          useValue: languagesService,
        },
      ],
    }).compile();

    service = module.get<LanguagesPublicService>(LanguagesPublicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return active public languages', async () => {
      languagesService.findAllActive.mockResolvedValue([
        {
          id: 1,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: '🇻🇳',
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: 2,
          code: 'en',
          name: 'English',
          flag: '🇺🇸',
          isDefault: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 1,
          code: 'vi',
          name: 'Tiếng Việt',
          flag: '🇻🇳',
          isDefault: true,
        }),
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: 2,
          code: 'en',
          name: 'English',
          flag: '🇺🇸',
          isDefault: false,
        }),
      );
    });
  });
});
