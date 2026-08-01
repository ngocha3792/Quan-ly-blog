import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockFetch = jest.fn();

  beforeEach(async () => {
    jest.resetAllMocks();

    Object.defineProperty(
      globalThis,
      'fetch',
      {
        value: mockFetch,
        writable: true,
        configurable: true,
      },
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          TranslationService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

    service =
      module.get<TranslationService>(
        TranslationService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should translate title and content with LibreTranslate', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    const json = jest.fn().mockResolvedValue({
      translatedText: [
        'NestJS Guide',
        '<p>English content</p>',
      ],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json,
    });

    const result =
      await service.translatePost({
        title: 'Hướng dẫn NestJS',
        content:
          '<p>Nội dung tiếng Việt</p>',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'en',
      });

    expect(
      mockConfigService.get,
    ).toHaveBeenCalledWith(
      'TRANSLATE_API_URL',
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/translate',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          q: [
            'Hướng dẫn NestJS',
            '<p>Nội dung tiếng Việt</p>',
          ],

          source: 'vi',
          target: 'en',
          format: 'html',
        }),
      },
    );

    expect(json).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      title: 'NestJS Guide',
      content:
        '<p>English content</p>',
    });
  });

  it('should trim and lowercase language codes before calling LibreTranslate', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    mockFetch.mockResolvedValue({
      ok: true,

      json: jest.fn().mockResolvedValue({
        translatedText: [
          'Hello',
          '<p>English content</p>',
        ],
      }),
    });

    await service.translatePost({
      title: 'Xin chào',
      content:
        '<p>Nội dung tiếng Việt</p>',
      sourceLanguageCode: ' VI ',
      targetLanguageCode: ' EN ',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/translate',
      expect.objectContaining({
        body: JSON.stringify({
          q: [
            'Xin chào',
            '<p>Nội dung tiếng Việt</p>',
          ],

          source: 'vi',
          target: 'en',
          format: 'html',
        }),
      }),
    );
  });

  it('should normalize Simplified Chinese aliases to zh', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    mockFetch.mockResolvedValue({
      ok: true,

      json: jest.fn().mockResolvedValue({
        translatedText: [
          'Hello',
          '<p>English content</p>',
        ],
      }),
    });

    await service.translatePost({
      title: '你好',
      content: '<p>中文内容</p>',
      sourceLanguageCode: 'zh-CN',
      targetLanguageCode: 'en',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/translate',
      expect.objectContaining({
        body: JSON.stringify({
          q: [
            '你好',
            '<p>中文内容</p>',
          ],

          source: 'zh',
          target: 'en',
          format: 'html',
        }),
      }),
    );
  });

  it('should normalize Traditional Chinese aliases to zt', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    mockFetch.mockResolvedValue({
      ok: true,

      json: jest.fn().mockResolvedValue({
        translatedText: [
          'Hello',
          '<p>English content</p>',
        ],
      }),
    });

    await service.translatePost({
      title: '你好',
      content: '<p>繁體中文內容</p>',
      sourceLanguageCode: 'zh-TW',
      targetLanguageCode: 'en',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/translate',
      expect.objectContaining({
        body: JSON.stringify({
          q: [
            '你好',
            '<p>繁體中文內容</p>',
          ],

          source: 'zt',
          target: 'en',
          format: 'html',
        }),
      }),
    );
  });

  it('should remove trailing slash from TRANSLATE_API_URL', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000/',
    );

    mockFetch.mockResolvedValue({
      ok: true,

      json: jest.fn().mockResolvedValue({
        translatedText: [
          'Hello',
          '<p>Content</p>',
        ],
      }),
    });

    await service.translatePost({
      title: 'Xin chào',
      content: '<p>Nội dung</p>',
      sourceLanguageCode: 'vi',
      targetLanguageCode: 'en',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/translate',
      expect.any(Object),
    );
  });

  it('should reject when source and target languages are the same', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    await expect(
      service.translatePost({
        title: 'Tiêu đề',
        content: '<p>Nội dung</p>',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'vi',
      }),
    ).rejects.toEqual(
      new BadRequestException(
        'Ngôn ngữ nguồn và ngôn ngữ đích phải khác nhau.',
      ),
    );

    /**
     * Phải chặn trước khi gọi LibreTranslate.
     */
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should compare source and target languages after normalization', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    await expect(
      service.translatePost({
        title: 'Chinese title',
        content:
          '<p>Chinese content</p>',
        sourceLanguageCode: 'zh-CN',
        targetLanguageCode: 'zh',
      }),
    ).rejects.toEqual(
      new BadRequestException(
        'Ngôn ngữ nguồn và ngôn ngữ đích phải khác nhau.',
      ),
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should throw ServiceUnavailableException when TRANSLATE_API_URL is missing', async () => {
    mockConfigService.get.mockReturnValue(
      undefined,
    );

    await expect(
      service.translatePost({
        title: 'Xin chào',
        content: 'Nội dung',
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
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    mockFetch.mockRejectedValue(
      new Error('ECONNREFUSED'),
    );

    await expect(
      service.translatePost({
        title: 'Xin chào',
        content: 'Nội dung',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'en',
      }),
    ).rejects.toEqual(
      new BadGatewayException(
        'Không thể kết nối tới dịch vụ dịch tự động.',
      ),
    );
  });

  it('should throw BadRequestException when LibreTranslate returns status 400 with an error message', async () => {
  mockConfigService.get.mockReturnValue(
    'http://localhost:5000',
  );

  const json = jest.fn().mockResolvedValue({
    error:
      'vi is not available as a source language',
  });

  mockFetch.mockResolvedValue({
    ok: false,
    status: 400,
    json,
  });

  await expect(
    service.translatePost({
      title: 'Xin chào',
      content: '<p>Nội dung</p>',
      sourceLanguageCode: 'vi',
      targetLanguageCode: 'km',
    }),
  ).rejects.toEqual(
    new BadRequestException(
      'Không thể dịch bài viết: vi is not available as a source language',
    ),
  );

  expect(json).toHaveBeenCalledTimes(1);
});

  it('should return a generic BadRequestException when LibreTranslate returns status 400 without readable error data', async () => {
  mockConfigService.get.mockReturnValue(
    'http://localhost:5000',
  );

  mockFetch.mockResolvedValue({
    ok: false,
    status: 400,
    json: jest
      .fn()
      .mockRejectedValue(
        new Error('Invalid JSON'),
      ),
  });

  await expect(
    service.translatePost({
      title: 'Xin chào',
      content: '<p>Nội dung</p>',
      sourceLanguageCode: 'vi',
      targetLanguageCode: 'km',
    }),
  ).rejects.toEqual(
    new BadRequestException(
      'Cặp ngôn ngữ không được dịch vụ dịch tự động hỗ trợ hoặc yêu cầu dịch không hợp lệ.',
    ),
  );
});

  it('should throw BadGatewayException when LibreTranslate returns non-OK response', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      service.translatePost({
        title: 'Xin chào',
        content: 'Nội dung',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'en',
      }),
    ).rejects.toEqual(
      new BadGatewayException(
        'Dịch vụ dịch tự động không thể xử lý yêu cầu.',
      ),
    );
  });

  it('should throw BadGatewayException when LibreTranslate returns invalid data', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    mockFetch.mockResolvedValue({
      ok: true,

      json: jest.fn().mockResolvedValue({
        translatedText:
          'Only one string',
      }),
    });

    await expect(
      service.translatePost({
        title: 'Xin chào',
        content: 'Nội dung',
        sourceLanguageCode: 'vi',
        targetLanguageCode: 'en',
      }),
    ).rejects.toEqual(
      new BadGatewayException(
        'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
      ),
    );
  });

  it('should throw BadGatewayException when translatedText array is incomplete', async () => {
    mockConfigService.get.mockReturnValue(
      'http://localhost:5000',
    );

    mockFetch.mockResolvedValue({
      ok: true,

      json: jest.fn().mockResolvedValue({
        translatedText: [
          'Only translated title',
        ],
      }),
    });

    await expect(
      service.translatePost({
        title: 'Xin chào',
        content: 'Nội dung',
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