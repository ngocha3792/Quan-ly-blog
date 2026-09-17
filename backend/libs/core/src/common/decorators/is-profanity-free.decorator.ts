// Mục đích: dùng trong DTO và service để chặn nội dung chứa từ cấm.
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import sanitizeHtml from 'sanitize-html';
import { FORBIDDEN_WORDS } from './forbidden-words';

/**
 * Chuẩn hóa nội dung trước khi kiểm tra:
 * - loại bỏ HTML tags để kiểm tra phần text thực tế;
 * - chuẩn hóa Unicode;
 * - chuyển thành chữ thường;
 * - gộp nhiều khoảng trắng thành một khoảng trắng.
 */
function normalizeText(text: string): string {
  const plainText = sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  });

  return plainText
    .normalize('NFKC')
    .toLocaleLowerCase('vi-VN')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escape các ký tự đặc biệt trước khi đưa một từ vào RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Kiểm tra một từ cấm có xuất hiện như một từ độc lập hay không.
 *
 * Không dùng includes() vì:
 * - "dm" không được làm từ "admin" bị chặn;
 * - "ngu" không được làm từ "nguyen" bị chặn.
 */
function containsForbiddenWord(text: string, forbiddenWord: string): boolean {
  const normalizedWord = normalizeText(forbiddenWord);
  const escapedWord = escapeRegExp(normalizedWord);

  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapedWord}(?=$|[^\\p{L}\\p{N}])`,
    'iu',
  );

  return pattern.test(text);
}

/**
 * Hàm dùng chung ngoài DTO.
 *
 * Dùng ở submit/finalize/worker để không phụ thuộc hoàn toàn vào
 * validation decorator lúc request đầu tiên đi vào controller.
 */
export function hasForbiddenWords(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  const normalizedText = normalizeText(value);

  return FORBIDDEN_WORDS.some((word) =>
    containsForbiddenWord(normalizedText, word),
  );
}

@ValidatorConstraint({
  name: 'isProfanityFree',
  async: false,
})
export class IsProfanityFreeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    return !hasForbiddenWords(value);
  }

  defaultMessage(): string {
    return 'Nội dung chứa từ ngữ không phù hợp với tiêu chuẩn cộng đồng.';
  }
}

export function IsProfanityFree(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      constraints: [],
      validator: IsProfanityFreeConstraint,
    });
  };
}
