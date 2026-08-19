import {
  PostStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import {
  BcryptUtil,
  JWTUtil,
  PrismaService,
} from '@app/core';

export async function createTestUser(
  prisma: PrismaService,
  bcryptUtil: BcryptUtil,
  overrides: {
    username?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    status?: UserStatus;
  } = {},
) {
  const password =
    overrides.password ??
    'Password123';

  const passwordHash =
    await bcryptUtil.hashPassword(
      password,
    );

  const suffix =
    `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  return prisma.user.create({
    data: {
      username:
        overrides.username ??
        `user_${suffix}`,

      email:
        overrides.email ??
        `user_${suffix}@example.com`,

      passwordHash,

      role:
        overrides.role ??
        UserRole.NORMAL,

      status:
        overrides.status ??
        UserStatus.ACTIVE,
    },
  });
}

export function createAccessToken(
  jwtUtil: JWTUtil,
  user: {
    id: number;
    role: UserRole;
    email: string;
  },
): string {
  return jwtUtil.generateAccessToken(
    user.id.toString(),
    user.role,
    user.email,
  );
}

export async function createLanguage(
  prisma: PrismaService,
  data: {
    code: string;
    name: string;
    isActive?: boolean;
    isDefault?: boolean;
    deletedAt?: Date | null;
  },
) {
  return prisma.language.create({
    data: {
      code: data.code,
      name: data.name,

      isActive:
        data.isActive ?? true,

      isDefault:
        data.isDefault ?? false,

      deletedAt:
        data.deletedAt ??
        null,
    },
  });
}

export async function createPost(
  prisma: PrismaService,
  data: {
    authorId: number;
    languageId: number;
    title?: string;
    status?: PostStatus;
    deletedAt?: Date | null;
  },
) {
  return prisma.post.create({
    data: {
      title:
        data.title ??
        `Post ${Date.now()}`,

      content:
        'E2E test content',

      authorId:
        data.authorId,

      languageId:
        data.languageId,

      status:
        data.status ??
        PostStatus.PUBLISH,

      publishedAt:
        data.status ===
        PostStatus.DRAFT
          ? null
          : new Date(),

      deletedAt:
        data.deletedAt ??
        null,
    },
  });
}
