import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchPostsDto, SearchSortOption } from './search-posts.dto';

describe('SearchPostsDto', () => {
  it('rejects a missing q', async () => {
    const dto = plainToInstance(SearchPostsDto, {});
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'q')).toBe(true);
  });

  it('rejects a q shorter than 2 characters', async () => {
    const dto = plainToInstance(SearchPostsDto, { q: 'a' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'q')).toBe(true);
  });

  it('rejects a q longer than 200 characters', async () => {
    const dto = plainToInstance(SearchPostsDto, { q: 'a'.repeat(201) });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'q')).toBe(true);
  });

  it('accepts a valid query with filters', async () => {
    const dto = plainToInstance(SearchPostsDto, {
      q: 'nestjs prisma',
      languageId: '1',
      sort: SearchSortOption.NEWEST,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
