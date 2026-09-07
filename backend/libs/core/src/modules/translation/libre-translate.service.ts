import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type LibreTranslateResponse = {
  translatedText: string | string[];
};

type LibreTranslateErrorResponse = {
  error?: string;
};

export type TranslateTextInput = {
  text: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  format?: 'text' | 'html';
};

export type TranslateTextsInput = {
  texts: string[];
  sourceLanguageCode: string;
  targetLanguageCode: string;
  format?: 'text' | 'html';
};

@Injectable()
export class LibreTranslateService {
  constructor(private readonly configService: ConfigService) {}

  private normalizeLanguageCode(languageCode: string): string {
    const normalizedCode = languageCode.trim().toLowerCase();

    const languageCodeAliases: Record<string, string> = {
      'zh-cn': 'zh',
      'zh-hans': 'zh',

      'zh-tw': 'zt',
      'zh-hant': 'zt',
    };

    return languageCodeAliases[normalizedCode] ?? normalizedCode;
  }

  private async translate(
    q: string | string[],
    sourceLanguageCode: string,
    targetLanguageCode: string,
    format: 'text' | 'html',
  ): Promise<string | string[]> {
    const baseUrl = this.configService.get<string>('TRANSLATE_API_URL');

    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'Dịch tự động chưa được cấu hình.',
      );
    }

    const source = this.normalizeLanguageCode(sourceLanguageCode);
    const target = this.normalizeLanguageCode(targetLanguageCode);

    if (source === target) {
      throw new BadRequestException(
        'Ngôn ngữ nguồn và ngôn ngữ đích phải khác nhau.',
      );
    }

    const url = `${baseUrl.replace(/\/$/, '')}/translate`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          q,
          source,
          target,
          format,
        }),
      });
    } catch {
      throw new BadGatewayException(
        'Không thể kết nối tới dịch vụ dịch tự động.',
      );
    }

    if (!response.ok) {
      if (response.status === 400) {
        let errorData: LibreTranslateErrorResponse | undefined;

        try {
          errorData = (await response.json()) as LibreTranslateErrorResponse;
        } catch {
          errorData = undefined;
        }

        throw new BadRequestException(
          errorData?.error
            ? `Không thể dịch nội dung: ${errorData.error}`
            : 'Cặp ngôn ngữ không được dịch vụ dịch tự động hỗ trợ hoặc yêu cầu dịch không hợp lệ.',
        );
      }

      throw new BadGatewayException(
        'Dịch vụ dịch tự động không thể xử lý yêu cầu.',
      );
    }

    let result: LibreTranslateResponse;

    try {
      result = (await response.json()) as LibreTranslateResponse;
    } catch {
      throw new BadGatewayException(
        'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
      );
    }

    return result.translatedText;
  }

  async translateText(input: TranslateTextInput): Promise<string> {
    const translatedText = await this.translate(
      input.text,
      input.sourceLanguageCode,
      input.targetLanguageCode,
      input.format ?? 'text',
    );

    if (typeof translatedText !== 'string') {
      throw new BadGatewayException(
        'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
      );
    }

    return translatedText;
  }

  async translateTexts(input: TranslateTextsInput): Promise<string[]> {
    const translatedTexts = await this.translate(
      input.texts,
      input.sourceLanguageCode,
      input.targetLanguageCode,
      input.format ?? 'text',
    );

    if (
      !Array.isArray(translatedTexts) ||
      translatedTexts.length !== input.texts.length ||
      !translatedTexts.every((text) => typeof text === 'string')
    ) {
      throw new BadGatewayException(
        'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
      );
    }

    return translatedTexts;
  }
}