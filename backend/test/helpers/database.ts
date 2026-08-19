import {
  PrismaService,
} from '@app/core';

export async function resetDatabase(
  prisma: PrismaService,
): Promise<void> {
  const tables =
    await prisma.$queryRaw<
      {
        tablename: string;
      }[]
    >`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
    `;

  if (
    tables.length === 0
  ) {
    return;
  }

  const quotedTables =
    tables
      .map(
        ({ tablename }) =>
          `"${tablename.replace(
            /"/g,
            '""',
          )}"`,
      )
      .join(', ');

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`,
  );
}
