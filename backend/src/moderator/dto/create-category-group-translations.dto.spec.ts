import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCategoryGroupTranslationsDto } from './create-category-group-translations.dto';

describe('CreateCategoryGroupTranslationsDto', () => {
  it('should accept a valid multilingual category group', async () => {
    const dto = plainToInstance(
      CreateCategoryGroupTranslationsDto,
      {
        code: 'programming',
        translations: [
          {
            languageId: 4,
            name: 'Lập trình',
          },
          {
            languageId: 1,
            name: 'Programming',
          },
        ],
      },
    );

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should normalize category group code to lowercase', async () => {
    const dto = plainToInstance(
      CreateCategoryGroupTranslationsDto,
      {
        code: 'Programming',
        translations: [
          {
            languageId: 4,
            name: 'Lập trình',
          },
        ],
      },
    );

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.code).toBe('programming');
  });

  it('should reject duplicate language IDs', async () => {
    const dto = plainToInstance(
      CreateCategoryGroupTranslationsDto,
      {
        code: 'technology-news',
        translations: [
          {
            languageId: 4,
            name: 'Công nghệ',
          },
          {
            languageId: 4,
            name: 'Tin công nghệ',
          },
        ],
      },
    );

    const errors = await validate(dto);

    const translationsError = errors.find(
      (error) => error.property === 'translations',
    );

    expect(translationsError).toBeDefined();
    expect(
      translationsError?.constraints?.arrayUnique,
    ).toBeDefined();
  });

  it('should reject an empty translations array', async () => {
    const dto = plainToInstance(
      CreateCategoryGroupTranslationsDto,
      {
        code: 'technology',
        translations: [],
      },
    );

    const errors = await validate(dto);

    const translationsError = errors.find(
      (error) => error.property === 'translations',
    );

    expect(translationsError).toBeDefined();
    expect(
      translationsError?.constraints?.arrayMinSize,
    ).toBeDefined();
  });

  it('should reject an invalid category group code', async () => {
    const dto = plainToInstance(
      CreateCategoryGroupTranslationsDto,
      {
        code: 'Công nghệ mới',
        translations: [
          {
            languageId: 4,
            name: 'Công nghệ mới',
          },
        ],
      },
    );

    const errors = await validate(dto);

    const codeError = errors.find(
      (error) => error.property === 'code',
    );

    expect(codeError).toBeDefined();
    expect(codeError?.constraints?.matches).toBeDefined();
  });
});