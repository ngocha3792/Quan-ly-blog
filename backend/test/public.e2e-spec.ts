import { INestApplication } from '@nestjs/common';

import request from 'supertest';

import { BcryptUtil, PrismaService } from '@app/core';

import { PostStatus } from '@prisma/client';

import { createE2EApp } from './helpers/create-e2e-app';

import { resetDatabase } from './helpers/database';

import {
  createLanguage,
  createPost,
  createTestUser,
} from './helpers/factories';

describe('Public API (e2e)', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let bcryptUtil: BcryptUtil;

  beforeAll(async () => {
    app = await createE2EApp();

    prisma = app.get(PrismaService);

    bcryptUtil = app.get(BcryptUtil);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);

    await app.close();
  });

  it('GET /posts?lang=inactive should not leak posts from inactive language', async () => {
    const author = await createTestUser(prisma, bcryptUtil);

    const vi = await createLanguage(prisma, {
      code: 'vi',
      name: 'Vietnamese',
      isActive: true,
      isDefault: true,
    });

    const ja = await createLanguage(prisma, {
      code: 'ja',
      name: 'Japanese',
      isActive: false,
    });

    await createPost(prisma, {
      authorId: author.id,

      languageId: vi.id,

      title: 'Vietnamese Post',
    });

    await createPost(prisma, {
      authorId: author.id,

      languageId: ja.id,

      title: 'Japanese Hidden Post',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/posts?lang=ja')
      .expect(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.items).toEqual([]);

    expect(response.body.data.meta.totalItems).toBe(0);
  });

  it('GET /posts/:id should return 404 when post language is inactive', async () => {
    const author = await createTestUser(prisma, bcryptUtil);

    const language = await createLanguage(prisma, {
      code: 'ja',
      name: 'Japanese',
      isActive: false,
    });

    const post = await createPost(prisma, {
      authorId: author.id,

      languageId: language.id,

      status: PostStatus.PUBLISH,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/posts/${post.id}`)
      .expect(404);
  });

  it('GET comments should return only 3 reply previews with replyCount', async () => {
    const author = await createTestUser(prisma, bcryptUtil);

    const commenter = await createTestUser(prisma, bcryptUtil);

    const language = await createLanguage(prisma, {
      code: 'vi',
      name: 'Vietnamese',
      isDefault: true,
    });

    const post = await createPost(prisma, {
      authorId: author.id,

      languageId: language.id,
    });

    const root = await prisma.comment.create({
      data: {
        postId: post.id,

        userId: commenter.id,

        content: 'Root comment',
      },
    });

    for (let i = 1; i <= 5; i++) {
      await prisma.comment.create({
        data: {
          postId: post.id,

          userId: author.id,

          parentId: root.id,

          content: `Reply ${i}`,
        },
      });
    }

    const response = await request(app.getHttpServer())
      .get(`/api/v1/posts/${post.id}/comments?page=1&limit=10`)
      .expect(200);

    const comment = response.body.data.items[0];

    expect(comment.id).toBe(root.id);

    expect(comment.replies).toHaveLength(3);

    expect(comment.replyCount).toBe(5);

    expect(comment.hasMoreReplies).toBe(true);
  });

  it('GET replies should use cursor pagination', async () => {
    const author = await createTestUser(prisma, bcryptUtil);

    const language = await createLanguage(prisma, {
      code: 'vi',
      name: 'Vietnamese',
      isDefault: true,
    });

    const post = await createPost(prisma, {
      authorId: author.id,

      languageId: language.id,
    });

    const root = await prisma.comment.create({
      data: {
        postId: post.id,

        userId: author.id,

        content: 'Root',
      },
    });

    const replies: { id: number }[] = [];

    for (let i = 1; i <= 5; i++) {
      replies.push(
        await prisma.comment.create({
          data: {
            postId: post.id,

            userId: author.id,

            parentId: root.id,

            content: `Reply ${i}`,
          },
        }),
      );
    }

    const firstPage = await request(app.getHttpServer())
      .get(`/api/v1/posts/${post.id}/comments/${root.id}/replies?limit=2`)
      .expect(200);

    expect(firstPage.body.data.items).toHaveLength(2);

    expect(firstPage.body.data.meta.hasMore).toBe(true);

    const cursor = firstPage.body.data.meta.nextCursor;

    expect(cursor).toBe(replies[1].id);

    const secondPage = await request(app.getHttpServer())
      .get(
        `/api/v1/posts/${post.id}/comments/${root.id}/replies?limit=2&cursor=${cursor}`,
      )
      .expect(200);

    expect(
      secondPage.body.data.items.map((reply: { id: number }) => reply.id),
    ).toEqual([replies[2].id, replies[3].id]);
  });
});
