import 'reflect-metadata';

import { instanceToPlain } from 'class-transformer';

import { ModeratorCategoryGroupEntity } from './moderator-category-group.entity';

describe('ModeratorCategoryGroupEntity', () => {
  it('should expose translations and hide raw relations', () => {
    const date = new Date(
      '2026-07-28T00:00:00.000Z',
    );

    const entity = new ModeratorCategoryGroupEntity({
      id: 10,
      code: 'programming',
      createdAt: date,
      updatedAt: date,
      deletedAt: null,

      categories: [
        {
          id: 20,
          name: 'Lập trình',
          categoryGroupId: 10,
          languageId: 4,
          createdAt: date,
          updatedAt: date,
          deletedAt: null,

          language: {
            id: 4,
            code: 'vi',
            name: 'Tiếng Việt',
            flag: 'VN',
            isDefault: true,
            isActive: true,
            createdAt: date,
            updatedAt: date,
            deletedAt: null,
          },
        },

        {
          id: 21,
          name: 'Programming',
          categoryGroupId: 10,
          languageId: 1,
          createdAt: date,
          updatedAt: date,
          deletedAt: null,

          language: {
            id: 1,
            code: 'en',
            name: 'English',
            flag: 'US',
            isDefault: false,
            isActive: true,
            createdAt: date,
            updatedAt: date,
            deletedAt: null,
          },
        },
      ],
    });

    const result = instanceToPlain(entity);

    expect(result).not.toHaveProperty('deletedAt');
    expect(result).not.toHaveProperty('categories');

    expect(result.id).toBe(10);
    expect(result.code).toBe('programming');
    expect(result.translationCount).toBe(2);

    expect(result.translations).toHaveLength(2);

    expect(result.translations[0]).toEqual(
      expect.objectContaining({
        id: 20,
        name: 'Lập trình',
        languageId: 4,
      }),
    );

    expect(result.translations[0]).not.toHaveProperty(
      'categoryGroupId',
    );
    expect(result.translations[0]).not.toHaveProperty(
      'categoryGroup',
    );
    expect(result.translations[0]).not.toHaveProperty(
      'deletedAt',
    );

    expect(result.translations[0].language).toEqual({
      id: 4,
      code: 'vi',
      name: 'Tiếng Việt',
      flag: 'VN',
      isDefault: true,
      isActive: true,
      createdAt: date,
      updatedAt: date,
    });

    expect(
      result.translations[0].language,
    ).not.toHaveProperty('deletedAt');
  });
});