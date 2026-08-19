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

  private normalizeLanguageCode(
  languageCode: string,
): string {
  const normalizedCode =
    languageCode.trim().toLowerCase();

  const languageCodeAliases: Record<
    string,
    string
  > = {
    'zh-cn': 'zh',
    'zh-hans': 'zh',

    'zh-tw': 'zt',
    'zh-hant': 'zt',
  };

  return (
    languageCodeAliases[normalizedCode] ??
    normalizedCode
  );
}

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

    const sourceLanguageCode =
  this.normalizeLanguageCode(
    input.sourceLanguageCode,
  );

  
  const targetLanguageCode =
  this.normalizeLanguageCode(
    input.targetLanguageCode,
  );

  if (
  sourceLanguageCode ===
  targetLanguageCode
) {
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
      q: [
        input.title,
        input.content,
      ],

      source: sourceLanguageCode,
      target: targetLanguageCode,
      format: 'html',
    }),
  });
} catch {
  throw new BadGatewayException(
    'Không thể kết nối tới dịch vụ dịch tự động.',
  );
}

if (!response.ok) {
  if (response.status === 400) {
    let errorData:
      | LibreTranslateErrorResponse
      | undefined;

    try {
      errorData =
        (await response.json()) as
          LibreTranslateErrorResponse;
    } catch {
      errorData = undefined;
    }

    throw new BadRequestException(
      errorData?.error
        ? `Không thể dịch bài viết: ${errorData.error}`
        : 'Cặp ngôn ngữ không được dịch vụ dịch tự động hỗ trợ hoặc yêu cầu dịch không hợp lệ.',
    );
  }

  throw new BadGatewayException(
    'Dịch vụ dịch tự động không thể xử lý yêu cầu.',
  );
}

let result: LibreTranslateResponse;

try {
  result =
    (await response.json()) as
      LibreTranslateResponse;
} catch {
  throw new BadGatewayException(
    'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
  );
}

if (
  !Array.isArray(result.translatedText) ||
  result.translatedText.length < 2 ||
  typeof result.translatedText[0] !==
    'string' ||
  typeof result.translatedText[1] !==
    'string'
) {
  throw new BadGatewayException(
    'Dịch vụ dịch tự động trả về dữ liệu không hợp lệ.',
  );
}

return {
  title: result.translatedText[0],
  content: result.translatedText[1],
};
  }
}