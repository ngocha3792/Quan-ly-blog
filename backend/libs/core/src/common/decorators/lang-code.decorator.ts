// Mục đích: Trích xuất language code từ query param ?lang hoặc header Accept-Language.
// Ưu tiên: ?lang > Accept-Language. Trả về null nếu không có.
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const LangCode = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string | null => {
        const request = ctx.switchToHttp().getRequest();
        const lang = request.query.lang as string | undefined;
        const acceptLanguage = request.headers['accept-language'] as string | undefined;

        if (lang) return lang;
        if (acceptLanguage) return acceptLanguage.split(',')[0].split('-')[0].trim();
        return null;
    },
);
