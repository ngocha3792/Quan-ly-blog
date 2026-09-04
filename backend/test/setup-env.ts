import { config } from 'dotenv';

config({
  path: '.env.test',
});

process.env.NODE_ENV = 'test';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('E2E DATABASE_URL chưa được cấu hình.');
}

const databaseName = new URL(databaseUrl).pathname.replace('/', '');

if (!/(e2e|test)/i.test(databaseName)) {
  throw new Error(
    [
      'TỪ CHỐI chạy E2E.',
      `Database hiện tại: ${databaseName}`,
      'Tên database phải chứa "e2e" hoặc "test".',
    ].join(' '),
  );
}
