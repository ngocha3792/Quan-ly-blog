//Mục đích: Dùng trong file DTO để chặn người dùng nhập từ ngữ thô tục vào comment hoặc tiêu đề.
import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator';

const BAD_WORDS = ['dm', 'vl', 'ngu']; // Danh sách từ cấm (có thể mở rộng)

@ValidatorConstraint({ async: false })
export class IsProfanityFreeConstraint implements ValidatorConstraintInterface {
    validate(text: string) {
        if (!text) return true;
        const lowerText = text.toLowerCase();
        // Trả về false nếu phát hiện từ cấm
        const hasBadWord = BAD_WORDS.some(word => lowerText.includes(word));
        return !hasBadWord;
    }

    defaultMessage() {
        return 'Nội dung chứa từ ngữ không phù hợp với tiêu chuẩn cộng đồng.';
    }
}

export function IsProfanityFree(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsProfanityFreeConstraint,
        });
    };
}
