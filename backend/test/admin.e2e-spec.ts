import { INestApplication } from '@nestjs/common';

import request from 'supertest';

import { BcryptUtil, JWTUtil, PrismaService } from '@app/core';

import { UserRole } from '@prisma/client';

import { createE2EApp } from './helpers/create-e2e-app';

import { resetDatabase } from './helpers/database';

import { createAccessToken, createTestUser } from './helpers/factories';

describe('Admin API (e2e)', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let bcryptUtil: BcryptUtil;

  let jwtUtil: JWTUtil;

  beforeAll(async () => {
    app = await createE2EApp();

    prisma = app.get(PrismaService);

    bcryptUtil = app.get(BcryptUtil);

    jwtUtil = app.get(JWTUtil);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAdmin() {
    const admin = await createTestUser(prisma, bcryptUtil, {
      username: 'superadmin',

      email: 'admin@example.com',

      role: UserRole.SUPER_ADMIN,
    });

    return {
      admin,

      token: createAccessToken(jwtUtil, admin),
    };
  }

  it('generic user update should reject role field', async () => {
    const { token } = await createAdmin();

    const target = await createTestUser(prisma, bcryptUtil);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: UserRole.CONTENT_MODERATOR,
      })
      .expect(400);

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        id: target.id,
      },
    });

    expect(user.role).toBe(UserRole.NORMAL);
  });

  it('admin password reset should revoke all active user sessions', async () => {
    const { token: adminToken } = await createAdmin();

    const target = await createTestUser(prisma, bcryptUtil, {
      username: 'targetuser',

      email: 'target@example.com',

      password: 'OldPassword123',
    });

    /**
     * Login thật để tạo UserSession thật.
     */
    const login = await request(app.getHttpServer())
      .post('/api/v1/login')
      .set('User-Agent', 'e2e-browser')
      .send({
        identifier: target.email,

        password: 'OldPassword123',
      })
      .expect(200);

    expect(login.body.data.tokens.refreshToken).toBeDefined();

    const activeBefore = await prisma.userSession.count({
      where: {
        userId: target.id,

        revokedAt: null,
      },
    });

    expect(activeBefore).toBe(1);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        password: 'NewPassword123',
      })
      .expect(200);

    const activeAfter = await prisma.userSession.count({
      where: {
        userId: target.id,

        revokedAt: null,
      },
    });

    expect(activeAfter).toBe(0);

    /**
     * Password cũ không dùng được nữa.
     */
    await request(app.getHttpServer())
      .post('/api/v1/login')
      .send({
        identifier: target.email,

        password: 'OldPassword123',
      })
      .expect(401);

    /**
     * Password mới hoạt động.
     */
    await request(app.getHttpServer())
      .post('/api/v1/login')
      .send({
        identifier: target.email,

        password: 'NewPassword123',
      })
      .expect(200);
  });

  it('switching default language should leave exactly one default', async () => {
    const { token } = await createAdmin();

    const vi = await request(app.getHttpServer())
      .post('/api/v1/admin/languages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'vi',
        name: 'Vietnamese',
      })
      .expect(201);

    expect(vi.body.data.isDefault).toBe(true);

    const en = await request(app.getHttpServer())
      .post('/api/v1/admin/languages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'en',
        name: 'English',
      })
      .expect(201);

    const enId = en.body.data.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/languages/${enId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        isDefault: true,
      })
      .expect(200);

    const defaults = await prisma.language.findMany({
      where: {
        isDefault: true,
        deletedAt: null,
      },
    });

    expect(defaults).toHaveLength(1);

    expect(defaults[0].id).toBe(enId);
  });

  it('should not allow unset, deactivate or delete current default language', async () => {
    const { token } = await createAdmin();

    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/languages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'vi',
        name: 'Vietnamese',
      })
      .expect(201);

    const id = response.body.data.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/languages/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        isDefault: false,
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/languages/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        isActive: false,
      })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/languages/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    const language = await prisma.language.findUniqueOrThrow({
      where: {
        id,
      },
    });

    expect(language.isDefault).toBe(true);

    expect(language.isActive).toBe(true);

    expect(language.deletedAt).toBeNull();
  });
});
