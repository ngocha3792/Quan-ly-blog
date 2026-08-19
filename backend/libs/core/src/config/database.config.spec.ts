import databaseConfig from './database.config';

describe('databaseConfig', () => {
  const originalPoolSize = process.env.DB_POOL_SIZE;

  afterEach(() => {
    if (originalPoolSize === undefined) {
      delete process.env.DB_POOL_SIZE;
    } else {
      process.env.DB_POOL_SIZE = originalPoolSize;
    }
  });

  it('should use the configured connection pool size', () => {
    process.env.DB_POOL_SIZE = '24';

    expect(databaseConfig().poolSize).toBe(24);
  });

  it.each(['0', '-1', 'invalid'])(
    'should fall back for invalid pool size %s',
    (poolSize) => {
      process.env.DB_POOL_SIZE = poolSize;

      expect(databaseConfig().poolSize).toBe(10);
    },
  );
});
