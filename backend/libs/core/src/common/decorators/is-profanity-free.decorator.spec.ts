import {
  hasForbiddenWords,
  IsProfanityFreeConstraint,
} from './is-profanity-free.decorator';

describe('IsProfanityFreeConstraint', () => {
  let validator: IsProfanityFreeConstraint;

  beforeEach(() => {
    validator = new IsProfanityFreeConstraint();
  });

  it('should accept normal Vietnamese content', () => {
    expect(validator.validate('Đây là một bài viết bình thường.')).toBe(true);
  });

  it('should reject a forbidden word', () => {
    expect(validator.validate('dm')).toBe(false);
  });

  it('should reject a forbidden word inside a sentence', () => {
    expect(validator.validate('Nội dung này có từ dm không phù hợp.')).toBe(
      false,
    );
  });

  it('should reject a forbidden word inside HTML content', () => {
    expect(validator.validate('<p>Nội dung <strong>dm</strong></p>')).toBe(
      false,
    );
  });

  it('should ignore uppercase and lowercase differences', () => {
    expect(validator.validate('Nội dung này có từ DM không phù hợp.')).toBe(
      false,
    );
  });

  it('should not reject admin because it contains dm', () => {
    expect(validator.validate('admin')).toBe(true);
  });

  it('should not reject nguyen because it contains ngu', () => {
    expect(validator.validate('nguyen')).toBe(true);
  });

  it('should expose the same check for service/worker defense-in-depth', () => {
    expect(hasForbiddenWords('<div>VL</div>')).toBe(true);
    expect(hasForbiddenWords('<div>Nội dung hợp lệ</div>')).toBe(false);
  });

  it('should accept empty optional values', () => {
    expect(validator.validate('')).toBe(true);
    expect(validator.validate(null)).toBe(true);
    expect(validator.validate(undefined)).toBe(true);
  });

  it('should reject non-string values', () => {
    expect(validator.validate(123)).toBe(false);
  });
});
