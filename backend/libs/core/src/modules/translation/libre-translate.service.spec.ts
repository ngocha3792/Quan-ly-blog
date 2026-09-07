import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { LibreTranslateService } from './libre-translate.service';

describe('LibreTranslateService', () => {
  let service: LibreTranslateService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockFetch = jest.fn();

  beforeEach(async () => {
    jest.resetAllMocks();

    Object.defineProperty(globalThis, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibreTranslateService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LibreTranslateService>(LibreTranslateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should translate a single text', async () => {
    mockConfigService.get.mockReturnValue('http://localhost:5000');

    const json = jest.fn().mockResolvedValue({
      translatedText: 'Technology',
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json,
    });

    const result = await service.translateText({
      text: 'Công nghệ',
      sourceLanguageCode: 'vi',
      targetLanguageCode: 'en',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/translate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: 'Công nghệ',
          source: 'vi',
          target: 'en',
          format: 'text',
        }),
      },
    );

    expect(result).toBe('Technology');
  });

  it('should translate multiple texts', async () => {
    mockConfigService.get.mockReturnValue('http://localhost:5000');

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        translatedText: [
          'NestJS Guide',
          '<p>English content</p>',
        ],
      }),
    });

    const result = await service.translateTexts({
      texts: [
        'Hướng dẫn NestJS',
        '<p>Nội dung tiếng Việt</p>',
      ],
      sourceLanguageCode: 'vi',
      targetLanguageCode: 'en',
      format: 'html',
    });

    expect(result).toEqual([
      'NestJS Guide',
      '<p>English content</p>',
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/translate',
      expect.objectContaining({
        body: JSON.stringify({
          q: [
            'Hướng dẫn NestJS',
            '<p>Nội dung tiếng Việt</p>',
          ],
          source: 'vi',
          target: 'en',
          format: 'html',
        }),
      }),
    );
  });

  it('should normalize language codes before translating', async () => {
    mockConfigService.get.mockReturnValue('http://localhost:5000');

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        translatedText: 'Hello',
      }),
    });

    await service.translateText({
      text: '你好',
      sourceLanguageCode: ' zh-CN ',
      targetLanguageCode: ' EN ',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/translate',
      expect.objectContaining({
        body: JSON.stringify({
          q: '你好',
          source: 'zh',
          target: 'en',
          format: 'text',
        }),
      }),
    );
  });

  it('should reject when source and target languages are the same', async () => {
    mockConfigService.get.mockReturnValue('http://localhost:5000');

    await expect(
      service.translateText({
        text: 'Công nghệ',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'vi',
      }),
    ).rejects.toEqual(
      new BadRequestException(
        'Ngôn ngữ nguồn và ngôn ngữ đích phải khác nhau.',
      ),
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should throw ServiceUnavailableException when translation API is not configured', async () => {
    mockConfigService.get.mockReturnValue(undefined);

    await expect(
      service.translateText({
        text: 'Công nghệ',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'en',
      }),
    ).rejects.toEqual(
      new ServiceUnavailableException(
        'Dịch tự động chưa được cấu hình.',
      ),
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should throw BadGatewayException when LibreTranslate cannot be reached', async () => {
    mockConfigService.get.mockReturnValue('http://localhost:5000');

    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.translateText({
        text: 'Công nghệ',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'en',
      }),
    ).rejects.toEqual(
      new BadGatewayException(
        'Không thể kết nối tới dịch vụ dịch tự động.',
      ),
    );
  });

  it('should expose LibreTranslate error when status is 400', async () => {
    mockConfigService.get.mockReturnValue('http://localhost:5000');

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        error: 'Language pair is not supported',
      }),
    });

    await expect(
      service.translateText({
        text: 'Công nghệ',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'xx',
      }),
    ).rejects.toEqual(
      new BadRequestException(
        'Không thể dịch nội dung: Language pair is not supported',
      ),
    );
  });

  it('should reject invalid single-text response', async () => {
    mockConfigService.get.mockReturnValue('http://localhost:5000');

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        translatedText: ['Technology'],
      }),
    });

    await expect(
      service.translateText({
        text: 'Công nghệ',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'en',
      }),
    ).rejects.toEqual(
      new BadGatewayException(
        'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
      ),
    );
  });

  it('should reject invalid multiple-text response', async () => {
    mockConfigService.get.mockReturnValue('http://localhost:5000');

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        translatedText: ['Only one translation'],
      }),
    });

    await expect(
      service.translateTexts({
        texts: ['Title', 'Content'],
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'en',
      }),
    ).rejects.toEqual(
      new BadGatewayException(
        'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
      ),
    );
  });
});