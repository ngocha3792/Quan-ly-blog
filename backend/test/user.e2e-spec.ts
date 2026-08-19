import {
  INestApplication,
} from '@nestjs/common';

import request from 'supertest';

import {
  BcryptUtil,
  JWTUtil,
  PrismaService,
} from '@app/core';

import {
  ReportReason,
} from '@prisma/client';

import {
  createE2EApp,
} from './helpers/create-e2e-app';

import {
  resetDatabase,
} from './helpers/database';

import {
  createAccessToken,
  createLanguage,
  createPost,
  createTestUser,
} from './helpers/factories';

describe(
  'User API (e2e)',
  () => {
    let app:
      INestApplication;

    let prisma:
      PrismaService;

    let bcryptUtil:
      BcryptUtil;

    let jwtUtil:
      JWTUtil;

    beforeAll(async () => {
      app =
        await createE2EApp();

      prisma =
        app.get(
          PrismaService,
        );

      bcryptUtil =
        app.get(
          BcryptUtil,
        );

      jwtUtil =
        app.get(
          JWTUtil,
        );
    });

    beforeEach(async () => {
      await resetDatabase(
        prisma,
      );
    });

    afterAll(async () => {
      await app.close();
    });

    it(
      'follow should be idempotent under concurrent requests',
      async () => {
        const follower =
          await createTestUser(
            prisma,
            bcryptUtil,
          );

        const target =
          await createTestUser(
            prisma,
            bcryptUtil,
          );

        const token =
          createAccessToken(
            jwtUtil,
            follower,
          );

        const [
          first,
          second,
        ] = await Promise.all([
          request(
            app.getHttpServer(),
          )
            .post(
              `/api/v1/user/follow/${target.id}`,
            )
            .set(
              'Authorization',
              `Bearer ${token}`,
            ),

          request(
            app.getHttpServer(),
          )
            .post(
              `/api/v1/user/follow/${target.id}`,
            )
            .set(
              'Authorization',
              `Bearer ${token}`,
            ),
        ]);

        expect(
          first.status,
        ).toBe(200);

        expect(
          second.status,
        ).toBe(200);

        const count =
          await prisma.userFollow.count({
            where: {
              followerId:
                follower.id,

              followingId:
                target.id,
            },
          });

        expect(count).toBe(1);
      },
    );

    it(
      'unfollow should be idempotent',
      async () => {
        const follower =
          await createTestUser(
            prisma,
            bcryptUtil,
          );

        const target =
          await createTestUser(
            prisma,
            bcryptUtil,
          );

        await prisma.userFollow.create({
          data: {
            followerId:
              follower.id,

            followingId:
              target.id,
          },
        });

        const token =
          createAccessToken(
            jwtUtil,
            follower,
          );

        await request(
          app.getHttpServer(),
        )
          .delete(
            `/api/v1/user/follow/${target.id}`,
          )
          .set(
            'Authorization',
            `Bearer ${token}`,
          )
          .expect(200);

        await request(
          app.getHttpServer(),
        )
          .delete(
            `/api/v1/user/follow/${target.id}`,
          )
          .set(
            'Authorization',
            `Bearer ${token}`,
          )
          .expect(200);

        expect(
          await prisma
            .userFollow
            .count(),
        ).toBe(0);
      },
    );

    it(
      'should allow only 5 comments per minute per user',
      async () => {
        const user =
          await createTestUser(
            prisma,
            bcryptUtil,
          );

        const author =
          await createTestUser(
            prisma,
            bcryptUtil,
          );

        const language =
          await createLanguage(
            prisma,
            {
              code: 'vi',
              name: 'Vietnamese',
              isDefault: true,
            },
          );

        const post =
          await createPost(
            prisma,
            {
              authorId:
                author.id,

              languageId:
                language.id,
            },
          );

        const token =
          createAccessToken(
            jwtUtil,
            user,
          );

        for (
          let i = 1;
          i <= 5;
          i++
        ) {
          await request(
            app.getHttpServer(),
          )
            .post(
              `/api/v1/user/posts/${post.id}/comments`,
            )
            .set(
              'Authorization',
              `Bearer ${token}`,
            )
            .send({
              content:
                `Comment number ${i}`,
            })
            .expect(201);
        }

        await request(
          app.getHttpServer(),
        )
          .post(
            `/api/v1/user/posts/${post.id}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${token}`,
          )
          .send({
            content:
              'Sixth comment',
          })
          .expect(429);

        const count =
          await prisma.comment.count({
            where: {
              userId:
                user.id,
            },
          });

        expect(count).toBe(5);
      },
    );

    it(
      'concurrent duplicate report should create exactly one pending report',
      async () => {
        const reporter =
          await createTestUser(
            prisma,
            bcryptUtil,
          );

        const author =
          await createTestUser(
            prisma,
            bcryptUtil,
          );

        const language =
          await createLanguage(
            prisma,
            {
              code: 'vi',
              name: 'Vietnamese',
              isDefault: true,
            },
          );

        const post =
          await createPost(
            prisma,
            {
              authorId:
                author.id,

              languageId:
                language.id,
            },
          );

        const token =
          createAccessToken(
            jwtUtil,
            reporter,
          );

        const createRequest = () =>
          request(
            app.getHttpServer(),
          )
            .post(
              `/api/v1/user/posts/${post.id}/reports`,
            )
            .set(
              'Authorization',
              `Bearer ${token}`,
            )
            .send({
              reason:
                ReportReason.SPAM,

              description:
                'E2E duplicate report',
            });

        const responses =
          await Promise.all([
            createRequest(),
            createRequest(),
          ]);

        const statuses =
          responses
            .map(
              (response) =>
                response.status,
            )
            .sort();

        expect(statuses)
          .toEqual([
            201,
            400,
          ]);

        const count =
          await prisma.report.count({
            where: {
              reporterId:
                reporter.id,

              postId:
                post.id,
            },
          });

        expect(count).toBe(1);
      },
    );
  },
);
