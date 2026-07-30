import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type LibreTranslateResponse = {
  translatedText: string | string[];
};

type TranslatePostInput = {
  title: string;
  content: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
};

@Injectable()
export class TranslationService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async translatePost(
    input: TranslatePostInput,
  ): Promise<{
    title: string;
    content: string;
  }> {
    const baseUrl =
      this.configService.get<string>(
        'TRANSLATE_API_URL',
      );

    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'Dịch tự động chưa được cấu hình.',
      );
    }

    const url = `${baseUrl.replace(/\/$/, '')}/translate`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          q: [
            input.title,
            input.content,
          ],

          source:
            input.sourceLanguageCode,

          target:
            input.targetLanguageCode,

          format: 'html',
        }),
      });
    } catch {
      throw new BadGatewayException(
        'Không thể kết nối tới dịch vụ dịch tự động.',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'Dịch vụ dịch tự động không thể xử lý yêu cầu.',
      );
    }

    const result =
      (await response.json()) as LibreTranslateResponse;

    if (
      !Array.isArray(
        result.translatedText,
      ) ||
      result.translatedText.length < 2
    ) {
      throw new BadGatewayException(
        'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
      );
    }

    return {
      title:
        result.translatedText[0],

      content:
        result.translatedText[1],
    };
  }
}