// //Mục đích: Dùng trong file DTO để chặn người dùng nhập từ ngữ thô tục vào comment hoặc tiêu đề.
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
 * - Chuẩn hóa Unicode.
 * - Chuyển thành chữ thường.
 * - Gộp nhiều khoảng trắng thành một khoảng trắng.
 */
function normalizeText(
  text: string,
): string {
  /**
   * Nếu input là HTML:
   *
   * <p>ngu</p>
   *
   * chuyển thành:
   *
   * ngu
   *
   * trước khi check.
   */
  const plainText =
    sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {},
    });

  return plainText
    .normalize('NFKC')
    .toLocaleLowerCase('vi-VN')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escape các ký tự đặc biệt trước khi đưa một từ vào RegExp.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Kiểm tra một từ cấm có xuất hiện như một từ độc lập hay không.
 *
 * Không dùng includes() vì:
 * - "dm" không được làm từ "admin" bị chặn.
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

@ValidatorConstraint({
  name: 'isProfanityFree',
  async: false,
})
export class IsProfanityFreeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    const normalizedText = normalizeText(value);

    return !FORBIDDEN_WORDS.some((word) =>
      containsForbiddenWord(normalizedText, word),
    );
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



// import {
//   registerDecorator,
//   ValidationOptions,
//   ValidatorConstraint,
//   ValidatorConstraintInterface,
// } from 'class-validator';

// const BAD_WORDS = ['dm', 'vl', 'ngu']; // Danh sách từ cấm (có thể mở rộng)

// @ValidatorConstraint({ async: false })
// export class IsProfanityFreeConstraint implements ValidatorConstraintInterface {
//   validate(text: string) {
//     if (!text) return true;
//     const lowerText = text.toLowerCase();
//     // Trả về false nếu phát hiện từ cấm
//     const hasBadWord = BAD_WORDS.some((word) => lowerText.includes(word));
//     return !hasBadWord;
//   }

//   defaultMessage() {
//     return 'Nội dung chứa từ ngữ không phù hợp với tiêu chuẩn cộng đồng.';
//   }
// }

// export function IsProfanityFree(validationOptions?: ValidationOptions) {
//   return function (object: Object, propertyName: string) {
//     registerDecorator({
//       target: object.constructor,
//       propertyName: propertyName,
//       options: validationOptions,
//       constraints: [],
//       validator: IsProfanityFreeConstraint,
//     });
//   };
// }
