import { createHash } from 'node:crypto';

import {
  BlogOwnerRequestStatus,
  MediaType,
  PostStatus,
  PrismaClient,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  UserRole,
  UserStatus,
} from '@prisma/client';

import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { BcryptUtil } from '../libs/core/src/common/utils/bcrypt.util';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const bcryptUtil = new BcryptUtil(
  new ConfigService({
    app: {
      passwordPepper: process.env.PASSWORD_PEPPER || '',
    },
  }),
);

/**
 * Tất cả tài khoản test, trừ SUPER_ADMIN, dùng mật khẩu này.
 */
const TEST_PASSWORD = 'Test123!';

/**
 * Tài khoản SUPER_ADMIN dùng mật khẩu riêng.
 */
const ADMIN_PASSWORD = 'Admin123!';

const CONFIG = {
  moderatorCount: 5,
  ownerCount: 30,
  normalUserCount: 120,

  vietnameseOriginalPosts: 120,
  englishTranslations: 80,
  englishStandalonePosts: 40,

  metricsDays: 30,
  securityLogCount: 500,
} as const;

// ======================================================
// DETERMINISTIC RANDOM
// ======================================================

/**
 * Random có seed cố định.
 *
 * Mỗi lần chạy seed sẽ tạo cấu trúc dữ liệu giống nhau,
 * dễ debug hơn Math.random().
 */
let randomSeed = 20260801;

function random(): number {
  randomSeed += 0x6d2b79f5;

  let value = randomSeed;

  value = Math.imul(
    value ^ (value >>> 15),
    value | 1,
  );

  value ^= value + Math.imul(
    value ^ (value >>> 7),
    value | 61,
  );

  return (
    ((value ^ (value >>> 14)) >>> 0) /
    4294967296
  );
}

function randomInt(
  min: number,
  max: number,
): number {
  return Math.floor(
    random() * (max - min + 1),
  ) + min;
}

function chance(probability: number): boolean {
  return random() < probability;
}

function pick<T>(values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error(
      'Không thể pick từ một mảng rỗng',
    );
  }

  return values[
    randomInt(0, values.length - 1)
  ];
}

function sampleUnique<T>(
  values: readonly T[],
  count: number,
): T[] {
  const cloned = [...values];

  for (
    let index = cloned.length - 1;
    index > 0;
    index -= 1
  ) {
    const selectedIndex = randomInt(
      0,
      index,
    );

    [
      cloned[index],
      cloned[selectedIndex],
    ] = [
        cloned[selectedIndex],
        cloned[index],
      ];
  }

  return cloned.slice(
    0,
    Math.min(count, cloned.length),
  );
}

function daysAgo(
  days: number,
  extraHours = 0,
): Date {
  const result = new Date();

  result.setUTCDate(
    result.getUTCDate() - days,
  );

  result.setUTCHours(
    result.getUTCHours() - extraHours,
  );

  return result;
}

function randomPastDate(
  maxDaysAgo: number,
): Date {
  return daysAgo(
    randomInt(0, maxDaysAgo),
    randomInt(0, 23),
  );
}

function startOfUtcDay(
  value: Date,
): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  );
}

function addHours(
  value: Date,
  hours: number,
): Date {
  return new Date(
    value.getTime() +
    hours * 60 * 60 * 1000,
  );
}

function sha256(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function pad(
  value: number,
  length = 3,
): string {
  return value
    .toString()
    .padStart(length, '0');
}

// ======================================================
// STATIC DATA
// ======================================================

const categoryDefinitions = [
  {
    code: 'BACKEND',
    vi: 'Backend',
    en: 'Backend',
  },
  {
    code: 'FRONTEND',
    vi: 'Frontend',
    en: 'Frontend',
  },
  {
    code: 'DATABASE',
    vi: 'Cơ sở dữ liệu',
    en: 'Database',
  },
  {
    code: 'DEVOPS',
    vi: 'DevOps',
    en: 'DevOps',
  },
  {
    code: 'ARTIFICIAL_INTELLIGENCE',
    vi: 'Trí tuệ nhân tạo',
    en: 'Artificial Intelligence',
  },
  {
    code: 'CLOUD_COMPUTING',
    vi: 'Điện toán đám mây',
    en: 'Cloud Computing',
  },
  {
    code: 'CYBER_SECURITY',
    vi: 'An toàn thông tin',
    en: 'Cyber Security',
  },
  {
    code: 'MOBILE_DEVELOPMENT',
    vi: 'Phát triển di động',
    en: 'Mobile Development',
  },
  {
    code: 'SOFTWARE_ARCHITECTURE',
    vi: 'Kiến trúc phần mềm',
    en: 'Software Architecture',
  },
  {
    code: 'CAREER',
    vi: 'Nghề nghiệp',
    en: 'Career',
  },
] as const;

const tagNames = [
  'NodeJS',
  'NestJS',
  'TypeScript',
  'JavaScript',
  'Angular',
  'React',
  'VueJS',
  'NextJS',
  'Prisma',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'Azure',
  'GoogleCloud',
  'CI-CD',
  'Microservices',
  'REST-API',
  'GraphQL',
  'Security',
  'Performance',
  'Testing',
  'CleanCode',
  'SystemDesign',
  'MachineLearning',
  'GenerativeAI',
  'Career',
] as const;

const topicDefinitions = [
  {
    vi: 'Xây dựng REST API với NestJS',
    en: 'Building REST APIs with NestJS',
  },
  {
    vi: 'Tối ưu truy vấn PostgreSQL',
    en: 'Optimizing PostgreSQL Queries',
  },
  {
    vi: 'Thiết kế hệ thống Microservices',
    en: 'Designing Microservice Systems',
  },
  {
    vi: 'Xác thực JWT an toàn',
    en: 'Secure JWT Authentication',
  },
  {
    vi: 'Angular Signals trong ứng dụng thực tế',
    en: 'Angular Signals in Real Applications',
  },
  {
    vi: 'Quản lý state phía frontend',
    en: 'Frontend State Management',
  },
  {
    vi: 'Docker hóa ứng dụng Node.js',
    en: 'Dockerizing Node.js Applications',
  },
  {
    vi: 'Triển khai ứng dụng lên Kubernetes',
    en: 'Deploying Applications to Kubernetes',
  },
  {
    vi: 'Tối ưu hiệu năng API',
    en: 'Improving API Performance',
  },
  {
    vi: 'Viết unit test hiệu quả',
    en: 'Writing Effective Unit Tests',
  },
  {
    vi: 'Clean Architecture với TypeScript',
    en: 'Clean Architecture with TypeScript',
  },
  {
    vi: 'Prisma ORM từ cơ bản đến nâng cao',
    en: 'Prisma ORM from Basic to Advanced',
  },
  {
    vi: 'Redis caching cho hệ thống lớn',
    en: 'Redis Caching for Large Systems',
  },
  {
    vi: 'Thiết kế database có khả năng mở rộng',
    en: 'Designing Scalable Databases',
  },
  {
    vi: 'Bảo mật ứng dụng web hiện đại',
    en: 'Securing Modern Web Applications',
  },
  {
    vi: 'CI/CD với GitHub Actions',
    en: 'CI/CD with GitHub Actions',
  },
  {
    vi: 'GraphQL so với REST API',
    en: 'GraphQL versus REST APIs',
  },
  {
    vi: 'Giám sát hệ thống production',
    en: 'Monitoring Production Systems',
  },
  {
    vi: 'Ứng dụng Generative AI trong lập trình',
    en: 'Using Generative AI in Development',
  },
  {
    vi: 'Kinh nghiệm phỏng vấn lập trình viên',
    en: 'Software Engineer Interview Experience',
  },
] as const;

const vietnameseComments = [
  'Bài viết rất hữu ích, cảm ơn tác giả.',
  'Phần giải thích này khá dễ hiểu.',
  'Mình đã áp dụng và thấy hiệu quả rõ rệt.',
  'Có thể viết thêm về phần triển khai production không?',
  'Ví dụ trong bài giúp mình hiểu vấn đề nhanh hơn.',
  'Mình đang gặp đúng vấn đề này trong dự án.',
  'Nội dung chi tiết và thực tế.',
  'Tác giả có thể chia sẻ thêm source code không?',
  'Phần tối ưu database rất đáng tham khảo.',
  'Mình sẽ thử cách này với dự án hiện tại.',
  'Bài viết có góc nhìn rất hay.',
  'Cảm ơn vì đã chia sẻ kiến thức.',
];

const englishComments = [
  'This article is very useful. Thank you.',
  'The explanation is clear and practical.',
  'I applied this approach and it worked well.',
  'Could you write more about production deployment?',
  'The examples make the concept much easier to understand.',
  'I am facing the same issue in my current project.',
  'This is detailed and practical content.',
  'Could you share a source-code example?',
  'The database optimization section is very helpful.',
  'I will try this approach in my project.',
  'This article provides a useful perspective.',
  'Thanks for sharing your experience.',
];

const vietnameseReplies = [
  'Mình cũng gặp trường hợp tương tự.',
  'Đồng ý, phần này rất thực tế.',
  'Cảm ơn bạn đã bổ sung.',
  'Mình đã thử và chạy ổn.',
  'Hy vọng tác giả viết thêm phần tiếp theo.',
];

const englishReplies = [
  'I had the same experience.',
  'Agreed, this part is very practical.',
  'Thanks for adding this information.',
  'I tested it and it works well.',
  'I hope there will be a follow-up article.',
];

const reportDescriptions = [
  'Nội dung có dấu hiệu quảng cáo không phù hợp.',
  'Một số thông tin trong bài chưa có nguồn kiểm chứng.',
  'Bình luận có nội dung công kích cá nhân.',
  'Nội dung bị lặp lại nhiều lần.',
  'Có dấu hiệu sao chép nội dung.',
];

const securityActions = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'REFRESH_TOKEN',
  'LOGOUT',
  'LOGOUT_ALL',
  'PASSWORD_RESET_REQUEST',
  'PASSWORD_RESET_SUCCESS',
  'PROFILE_UPDATED',
  'ACCOUNT_LOCKED',
] as const;

// ======================================================
// CONTENT GENERATORS
// ======================================================

function createVietnameseContent(
  title: string,
  index: number,
): string {
  return [
    title,
    '',
    `Trong bài viết số ${index}, chúng ta sẽ phân tích vấn đề từ góc độ thiết kế, triển khai và vận hành thực tế.`,
    '',
    '1. Bối cảnh',
    'Khi hệ thống phát triển, việc lựa chọn kiến trúc và công cụ phù hợp ảnh hưởng trực tiếp đến khả năng mở rộng, bảo trì và hiệu năng.',
    '',
    '2. Cách triển khai',
    'Hãy chia nhỏ trách nhiệm của từng module, kiểm soát dữ liệu đầu vào, xử lý lỗi tập trung và viết kiểm thử cho các luồng nghiệp vụ quan trọng.',
    '',
    '3. Tối ưu',
    'Theo dõi log, truy vấn database, bộ nhớ và thời gian phản hồi để xác định chính xác điểm nghẽn trước khi tối ưu.',
    '',
    '4. Kết luận',
    'Một giải pháp tốt cần cân bằng giữa tính đơn giản, khả năng mở rộng và chi phí vận hành.',
  ].join('\n');
}

function createEnglishContent(
  title: string,
  index: number,
): string {
  return [
    title,
    '',
    `In article number ${index}, we examine the topic from practical design, implementation, and operational perspectives.`,
    '',
    '1. Context',
    'As a system grows, architecture and technology choices directly affect scalability, maintainability, and performance.',
    '',
    '2. Implementation',
    'Separate module responsibilities, validate incoming data, centralize error handling, and test important business flows.',
    '',
    '3. Optimization',
    'Measure logs, database queries, memory usage, and response times before attempting optimization.',
    '',
    '4. Conclusion',
    'A strong solution balances simplicity, scalability, and operational cost.',
  ].join('\n');
}

function randomPostStatus(): PostStatus {
  const value = random();

  if (value < 0.76) {
    return PostStatus.PUBLISH;
  }

  if (value < 0.86) {
    return PostStatus.PENDING_REVIEW;
  }

  if (value < 0.94) {
    return PostStatus.DRAFT;
  }

  return PostStatus.REJECT;
}

function randomReportStatus(): ReportStatus {
  const value = random();

  if (value < 0.55) {
    return ReportStatus.PENDING;
  }

  if (value < 0.82) {
    return ReportStatus.RESOLVED;
  }

  return ReportStatus.REJECTED;
}

function randomReportReason(): ReportReason {
  return pick([
    ReportReason.SPAM,
    ReportReason.HARASSMENT,
    ReportReason.INAPPROPRIATE,
    ReportReason.COPYRIGHT,
    ReportReason.MISINFORMATION,
    ReportReason.OTHER,
  ]);
}

// ======================================================
// RESET DATABASE
// ======================================================

async function resetDatabase(): Promise<void> {
  console.log('🧹 Đang xóa dữ liệu cũ...');

  await prisma.report.deleteMany();
  await prisma.securityLog.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.passwordResetToken.deleteMany();

  await prisma.postDailyMetric.deleteMany();
  await prisma.postViewLog.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.postBookmark.deleteMany();
  await prisma.postTag.deleteMany();
  await prisma.postCategory.deleteMany();
  await prisma.media.deleteMany();

  /**
   * Ngắt self relation trước khi xóa toàn bộ comment.
   */
  await prisma.comment.updateMany({
    data: {
      parentId: null,
    },
  });

  await prisma.comment.deleteMany();

  /**
   * Ngắt relation bài dịch trước khi xóa toàn bộ post.
   */
  await prisma.post.updateMany({
    data: {
      parentPostId: null,
    },
  });

  await prisma.post.deleteMany();

  await prisma.blogOwnerRequest.deleteMany();
  await prisma.userFollow.deleteMany();

  /**
   * Ngắt self relation users.lockedById.
   */
  await prisma.user.updateMany({
    data: {
      lockedById: null,
    },
  });

  await prisma.user.deleteMany();

  await prisma.category.deleteMany();
  await prisma.categoryGroup.deleteMany();
  await prisma.language.deleteMany();
  await prisma.tag.deleteMany();
}

// ======================================================
// SEED USERS
// ======================================================

async function seedUsers() {
  console.log('👤 Đang tạo người dùng...');

  const adminPasswordHash =
    await bcryptUtil.hashPassword(ADMIN_PASSWORD);

  const testPasswordHash =
    await bcryptUtil.hashPassword(TEST_PASSWORD);

  const superAdmin = await prisma.user.create({
    data: {
      username: 'super_admin',
      email: 'super.admin@seed.local',
      passwordHash: adminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      bio: 'Tài khoản quản trị cao nhất dùng để kiểm thử.',
      avatarUrl:
        'https://i.pravatar.cc/300?img=1',
      createdAt: daysAgo(800),
    },
  });

  await prisma.user.createMany({
    data: [
      ...Array.from(
        {
          length: CONFIG.moderatorCount,
        },
        (_, index) => {
          const number = index + 1;

          return {
            username:
              `moderator_${pad(number)}`,
            email:
              `moderator.${pad(number)}@seed.local`,
            passwordHash: testPasswordHash,
            role:
              UserRole.CONTENT_MODERATOR,
            status: UserStatus.ACTIVE,
            bio:
              `Content Moderator số ${number}`,
            avatarUrl:
              `https://i.pravatar.cc/300?img=${10 + number
              }`,
            createdAt:
              randomPastDate(700),
          };
        },
      ),

      ...Array.from(
        {
          length: CONFIG.ownerCount,
        },
        (_, index) => {
          const number = index + 1;

          return {
            username:
              `owner_${pad(number)}`,
            email:
              `owner.${pad(number)}@seed.local`,
            passwordHash: testPasswordHash,
            role: UserRole.BLOG_OWNER,
            status: UserStatus.ACTIVE,
            bio:
              `Blog Owner chuyên chia sẻ kiến thức công nghệ số ${number}.`,
            avatarUrl:
              `https://i.pravatar.cc/300?img=${20 + (number % 50)
              }`,
            createdAt:
              randomPastDate(650),
          };
        },
      ),

      ...Array.from(
        {
          length:
            CONFIG.normalUserCount,
        },
        (_, index) => {
          const number = index + 1;

          return {
            username:
              `user_${pad(number)}`,
            email:
              `user.${pad(number)}@seed.local`,
            passwordHash: testPasswordHash,
            role: UserRole.NORMAL,
            status: UserStatus.ACTIVE,
            bio:
              chance(0.75)
                ? `Người dùng yêu thích công nghệ số ${number}.`
                : null,
            avatarUrl:
              chance(0.7)
                ? `https://i.pravatar.cc/300?img=${1 + (number % 70)
                }`
                : null,
            createdAt:
              randomPastDate(600),
          };
        },
      ),
    ],
  });

  const users = await prisma.user.findMany({
    orderBy: {
      id: 'asc',
    },
  });

  const moderators = users.filter(
    (user) =>
      user.role ===
      UserRole.CONTENT_MODERATOR,
  );

  const owners = users.filter(
    (user) =>
      user.role === UserRole.BLOG_OWNER,
  );

  const normalUsers = users.filter(
    (user) =>
      user.role === UserRole.NORMAL,
  );

  /**
   * Khóa một số tài khoản để test trạng thái LOCKED.
   */
  const lockedUsers = sampleUnique(
    normalUsers,
    8,
  );

  for (const user of lockedUsers) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        status: UserStatus.LOCKED,
        lockedAt: randomPastDate(30),
        lockedById: superAdmin.id,
        lockReason:
          'Tài khoản thử nghiệm bị khóa do vi phạm chính sách.',
      },
    });
  }

  return {
    superAdmin,
    moderators,
    owners,
    normalUsers,
    allUsers: users,
  };
}

// ======================================================
// SEED LANGUAGES, CATEGORIES, TAGS
// ======================================================

async function seedTaxonomy() {
  console.log(
    '🌐 Đang tạo ngôn ngữ, danh mục và tag...',
  );

  const vietnamese =
    await prisma.language.create({
      data: {
        code: 'vi',
        name: 'Tiếng Việt',
        flag: '🇻🇳',
        isDefault: true,
        isActive: true,
      },
    });

  const english =
    await prisma.language.create({
      data: {
        code: 'en',
        name: 'English',
        flag: '🇬🇧',
        isDefault: false,
        isActive: true,
      },
    });

  await prisma.categoryGroup.createMany({
    data: categoryDefinitions.map(
      (definition) => ({
        code: definition.code,
      }),
    ),
  });

  const groups =
    await prisma.categoryGroup.findMany({
      orderBy: {
        id: 'asc',
      },
    });

  const groupByCode = new Map(
    groups.map((group) => [
      group.code,
      group,
    ]),
  );

  await prisma.category.createMany({
    data: categoryDefinitions.flatMap(
      (definition) => {
        const group = groupByCode.get(
          definition.code,
        );

        if (!group) {
          throw new Error(
            `Không tìm thấy category group ${definition.code}`,
          );
        }

        return [
          {
            categoryGroupId: group.id,
            languageId: vietnamese.id,
            name: definition.vi,
          },
          {
            categoryGroupId: group.id,
            languageId: english.id,
            name: definition.en,
          },
        ];
      },
    ),
  });

  await prisma.tag.createMany({
    data: tagNames.map((name) => ({
      name,
    })),
  });

  const categories =
    await prisma.category.findMany({
      include: {
        categoryGroup: true,
        language: true,
      },
    });

  const tags = await prisma.tag.findMany({
    orderBy: {
      id: 'asc',
    },
  });

  const categoryIdByGroupAndLanguage =
    new Map<string, number>();

  for (const category of categories) {
    categoryIdByGroupAndLanguage.set(
      `${category.categoryGroup.code}:${category.language.code}`,
      category.id,
    );
  }

  return {
    vietnamese,
    english,
    groups,
    categories,
    tags,
    categoryIdByGroupAndLanguage,
  };
}

// ======================================================
// SEED USER RELATIONS
// ======================================================

async function seedUserRelations(
  users: Awaited<
    ReturnType<typeof seedUsers>
  >,
): Promise<void> {
  console.log(
    '🤝 Đang tạo follow, session và yêu cầu Blog Owner...',
  );

  const activeUsers =
    users.allUsers.filter(
      (user) =>
        user.status === UserStatus.ACTIVE,
    );

  const followPairs = new Set<string>();

  for (const follower of activeUsers) {
    const followingCandidates =
      activeUsers.filter(
        (candidate) =>
          candidate.id !== follower.id,
      );

    const followingCount = randomInt(
      3,
      Math.min(
        18,
        followingCandidates.length,
      ),
    );

    for (
      const following of sampleUnique(
        followingCandidates,
        followingCount,
      )
    ) {
      followPairs.add(
        `${follower.id}:${following.id}`,
      );
    }
  }

  await prisma.userFollow.createMany({
    data: [...followPairs].map((pair) => {
      const [
        followerId,
        followingId,
      ] = pair
        .split(':')
        .map(Number);

      return {
        followerId,
        followingId,
        createdAt:
          randomPastDate(500),
      };
    }),
    skipDuplicates: true,
  });

  const reviewers = [
    users.superAdmin,
    ...users.moderators,
  ];

  const requestUsers = sampleUnique(
    users.normalUsers.filter(
      (user) =>
        user.status === UserStatus.ACTIVE,
    ),
    35,
  );

  await prisma.blogOwnerRequest.createMany({
    data: requestUsers.map(
      (user, index) => {
        let status: BlogOwnerRequestStatus;

        if (index < 15) {
          status =
            BlogOwnerRequestStatus.PENDING;
        } else if (index < 27) {
          status =
            BlogOwnerRequestStatus.REJECTED;
        } else {
          status =
            BlogOwnerRequestStatus.APPROVED;
        }

        const reviewed =
          status !==
          BlogOwnerRequestStatus.PENDING;

        const reviewer = reviewed
          ? pick(reviewers)
          : null;

        return {
          userId: user.id,
          reason:
            'Tôi muốn chia sẻ kiến thức và kinh nghiệm phát triển phần mềm.',
          topics:
            pick([
              'NestJS, Prisma, PostgreSQL',
              'Angular, TypeScript',
              'Docker, Kubernetes, CI/CD',
              'AI, Machine Learning',
              'Security, System Design',
            ]),
          status,
          reviewedById:
            reviewer?.id ?? null,
          reviewedAt: reviewed
            ? randomPastDate(40)
            : null,
          rejectionReason:
            status ===
              BlogOwnerRequestStatus.REJECTED
              ? 'Nội dung đăng ký chưa mô tả đủ kinh nghiệm và chủ đề dự kiến.'
              : null,
          createdAt:
            randomPastDate(90),
        };
      },
    ),
  });

  const sessionUsers = sampleUnique(
    activeUsers,
    Math.min(90, activeUsers.length),
  );

  const sessionData = await Promise.all(
    sessionUsers.flatMap((user, userIndex) => {
      const sessionCount = chance(0.3) ? 2 : 1;
      return Array.from({ length: sessionCount }, async (_, sessionIndex) => ({
        userId: user.id,
        refreshTokenHash: await bcryptUtil.hashPassword(
          `seed-refresh-${user.id}-${userIndex}-${sessionIndex}`,
        ),
        deviceInfo:
          sessionIndex === 0
            ? 'Mozilla/5.0 Chrome Seed Browser'
            : 'Mozilla/5.0 Mobile Seed Browser',
        ipAddress: `192.168.${userIndex % 20}.${10 + sessionIndex}`,
        expiresAt: daysAgo(-30),
        revokedAt: chance(0.12) ? randomPastDate(20) : null,
        createdAt: randomPastDate(25),
      }));
    }).flat(),
  );

  await prisma.userSession.createMany({
    data: sessionData,
  });

  const resetUsers = sampleUnique(
    activeUsers,
    15,
  );

  const resetTokenData = await Promise.all(
    resetUsers.map(async (user, index) => ({
      userId: user.id,
      tokenHash: await bcryptUtil.hashPassword(
        `reset-token-${user.id}-${index}`,
      ),
      expiresAt:
        index < 5
          ? daysAgo(2)
          : daysAgo(-1),
      usedAt:
        index >= 5 && index < 9
          ? randomPastDate(1)
          : null,
      createdAt:
        randomPastDate(5),
    })),
  );

  await prisma.passwordResetToken.createMany({
    data: resetTokenData,
  });

await prisma.securityLog.createMany({
  data: Array.from(
    {
      length:
        CONFIG.securityLogCount,
    },
    (_, index) => {
      const user = chance(0.9)
        ? pick(users.allUsers)
        : null;

      return {
        userId: user?.id ?? null,
        ipAddress:
          `10.${index % 255}.${(index * 7) % 255
          }.${10 + (index % 200)}`,
        action: pick(securityActions),
        userAgent:
          chance(0.8)
            ? 'Mozilla/5.0 Seed Browser'
            : null,
        createdAt:
          randomPastDate(120),
      };
    },
  ),
});
}

// ======================================================
// SEED POSTS
// ======================================================

interface SeededPost {
  id: number;
  authorId: number;
  languageId: number;
  status: PostStatus;
  publishedAt: Date | null;
  createdAt: Date;
  viewCount: number;
  parentPostId: number | null;
}

async function seedPosts(
  users: Awaited<
    ReturnType<typeof seedUsers>
  >,
  taxonomy: Awaited<
    ReturnType<typeof seedTaxonomy>
  >,
) {
  console.log('📝 Đang tạo bài viết...');

  const reviewers = [
    users.superAdmin,
    ...users.moderators,
  ];

  const vietnamesePosts: SeededPost[] =
    [];

  for (
    let index = 1;
    index <=
    CONFIG.vietnameseOriginalPosts;
    index += 1
  ) {
    const owner = pick(users.owners);
    const topic = pick(topicDefinitions);
    const status = randomPostStatus();

    const title =
      `${topic.vi} — Phần ${index}`;

    const createdAt =
      randomPastDate(365);

    const publishedAt =
      status === PostStatus.PUBLISH
        ? addHours(
          createdAt,
          randomInt(2, 96),
        )
        : null;

    const reviewed =
      status === PostStatus.PUBLISH ||
      status === PostStatus.REJECT;

    const reviewer = reviewed
      ? pick(reviewers)
      : null;

    const post = await prisma.post.create({
      data: {
        title,
        thumbnailUrl:
          chance(0.86)
            ? `https://picsum.photos/seed/vi-post-${index}/1200/630`
            : null,
        content:
          createVietnameseContent(
            title,
            index,
          ),
        status,
        viewCount:
          status === PostStatus.PUBLISH
            ? randomInt(10, 15000)
            : 0,
        publishedAt,

        authorId: owner.id,
        languageId:
          taxonomy.vietnamese.id,

        reviewedById:
          reviewer?.id ?? null,
        reviewedAt: reviewed
          ? addHours(
            createdAt,
            randomInt(1, 48),
          )
          : null,
        rejectionReason:
          status === PostStatus.REJECT
            ? 'Nội dung chưa đáp ứng tiêu chuẩn xuất bản.'
            : null,

        createdAt,
      },
    });

    vietnamesePosts.push(post);
  }

  const translatedSourcePosts =
    sampleUnique(
      vietnamesePosts,
      CONFIG.englishTranslations,
    );

  const translatedPosts: SeededPost[] =
    [];

  for (
    let index = 0;
    index < translatedSourcePosts.length;
    index += 1
  ) {
    const source =
      translatedSourcePosts[index];

    const topic = pick(topicDefinitions);

    /**
     * Bài dịch thường giữ trạng thái gần giống bài gốc.
     */
    const status =
      source.status === PostStatus.PUBLISH
        ? chance(0.9)
          ? PostStatus.PUBLISH
          : PostStatus.PENDING_REVIEW
        : randomPostStatus();

    const title =
      `${topic.en} — Translation ${index + 1
      }`;

    const createdAt = addHours(
      source.createdAt,
      randomInt(12, 240),
    );

    const publishedAt =
      status === PostStatus.PUBLISH
        ? addHours(
          createdAt,
          randomInt(2, 72),
        )
        : null;

    const reviewed =
      status === PostStatus.PUBLISH ||
      status === PostStatus.REJECT;

    const reviewer = reviewed
      ? pick(reviewers)
      : null;

    const post = await prisma.post.create({
      data: {
        title,
        thumbnailUrl:
          chance(0.85)
            ? `https://picsum.photos/seed/en-translation-${index}/1200/630`
            : null,
        content:
          createEnglishContent(
            title,
            index + 1,
          ),
        status,
        viewCount:
          status === PostStatus.PUBLISH
            ? randomInt(10, 10000)
            : 0,
        publishedAt,

        parentPostId: source.id,
        authorId: source.authorId,
        languageId:
          taxonomy.english.id,

        reviewedById:
          reviewer?.id ?? null,
        reviewedAt: reviewed
          ? addHours(
            createdAt,
            randomInt(1, 48),
          )
          : null,
        rejectionReason:
          status === PostStatus.REJECT
            ? 'The content does not meet the publication requirements.'
            : null,

        createdAt,
      },
    });

    translatedPosts.push(post);
  }

  const standaloneEnglishPosts: SeededPost[] =
    [];

  for (
    let index = 1;
    index <=
    CONFIG.englishStandalonePosts;
    index += 1
  ) {
    const owner = pick(users.owners);
    const topic = pick(topicDefinitions);
    const status = randomPostStatus();

    const title =
      `${topic.en} — Edition ${index}`;

    const createdAt =
      randomPastDate(300);

    const publishedAt =
      status === PostStatus.PUBLISH
        ? addHours(
          createdAt,
          randomInt(2, 96),
        )
        : null;

    const reviewed =
      status === PostStatus.PUBLISH ||
      status === PostStatus.REJECT;

    const reviewer = reviewed
      ? pick(reviewers)
      : null;

    const post = await prisma.post.create({
      data: {
        title,
        thumbnailUrl:
          chance(0.85)
            ? `https://picsum.photos/seed/en-post-${index}/1200/630`
            : null,
        content:
          createEnglishContent(
            title,
            index,
          ),
        status,
        viewCount:
          status === PostStatus.PUBLISH
            ? randomInt(10, 12000)
            : 0,
        publishedAt,

        authorId: owner.id,
        languageId:
          taxonomy.english.id,

        reviewedById:
          reviewer?.id ?? null,
        reviewedAt: reviewed
          ? addHours(
            createdAt,
            randomInt(1, 48),
          )
          : null,
        rejectionReason:
          status === PostStatus.REJECT
            ? 'The content does not meet the publication requirements.'
            : null,

        createdAt,
      },
    });

    standaloneEnglishPosts.push(post);
  }

  const allPosts = [
    ...vietnamesePosts,
    ...translatedPosts,
    ...standaloneEnglishPosts,
  ];

  return {
    vietnamesePosts,
    translatedPosts,
    standaloneEnglishPosts,
    allPosts,
  };
}

// ======================================================
// SEED POST RELATIONS
// ======================================================

async function seedPostRelations(
  users: Awaited<
    ReturnType<typeof seedUsers>
  >,
  taxonomy: Awaited<
    ReturnType<typeof seedTaxonomy>
  >,
  posts: Awaited<
    ReturnType<typeof seedPosts>
  >,
) {
  console.log(
    '🔗 Đang tạo category, tag và media cho bài viết...',
  );

  const postCategoryData: Array<{
    postId: number;
    categoryId: number;
  }> = [];

  const postTagData: Array<{
    postId: number;
    tagId: number;
  }> = [];

  const mediaData: Array<{
    postId: number;
    mediaType: MediaType;
    mediaUrl: string;
    publicId: string;
    createdAt: Date;
  }> = [];

  const groupCodes =
    categoryDefinitions.map(
      (definition) => definition.code,
    );

  for (const post of posts.allPosts) {
    const languageCode =
      post.languageId ===
        taxonomy.vietnamese.id
        ? 'vi'
        : 'en';

    const selectedGroups =
      sampleUnique(
        groupCodes,
        randomInt(1, 3),
      );

    for (const groupCode of selectedGroups) {
      const categoryId =
        taxonomy.categoryIdByGroupAndLanguage.get(
          `${groupCode}:${languageCode}`,
        );

      if (!categoryId) {
        throw new Error(
          `Không tìm thấy category ${groupCode}:${languageCode}`,
        );
      }

      postCategoryData.push({
        postId: post.id,
        categoryId,
      });
    }

    const selectedTags = sampleUnique(
      taxonomy.tags,
      randomInt(2, 6),
    );

    for (const tag of selectedTags) {
      postTagData.push({
        postId: post.id,
        tagId: tag.id,
      });
    }

    if (chance(0.62)) {
      mediaData.push({
        postId: post.id,
        mediaType: MediaType.IMAGE,
        mediaUrl:
          `https://picsum.photos/seed/post-media-${post.id}/1400/900`,
        publicId:
          `seed/post/${post.id}/image-1`,
        createdAt: addHours(
          post.createdAt,
          randomInt(1, 12),
        ),
      });
    }

    if (chance(0.08)) {
      mediaData.push({
        postId: post.id,
        mediaType: MediaType.VIDEO,
        mediaUrl:
          'https://www.w3schools.com/html/mov_bbb.mp4',
        publicId:
          `seed/post/${post.id}/video-1`,
        createdAt: addHours(
          post.createdAt,
          randomInt(1, 12),
        ),
      });
    }
  }

  await prisma.postCategory.createMany({
    data: postCategoryData,
    skipDuplicates: true,
  });

  await prisma.postTag.createMany({
    data: postTagData,
    skipDuplicates: true,
  });

  await prisma.media.createMany({
    data: mediaData,
  });

  const publishedPosts =
    posts.allPosts.filter(
      (post) =>
        post.status ===
        PostStatus.PUBLISH,
    );

  const activeUsers =
    users.allUsers.filter(
      (user) =>
        user.status === UserStatus.ACTIVE,
    );

  const likeData: Array<{
    postId: number;
    userId: number;
    createdAt: Date;
  }> = [];

  const bookmarkData: Array<{
    postId: number;
    userId: number;
    createdAt: Date;
  }> = [];

  for (const post of publishedPosts) {
    const likeUsers = sampleUnique(
      activeUsers,
      randomInt(
        3,
        Math.min(
          55,
          activeUsers.length,
        ),
      ),
    );

    for (const user of likeUsers) {
      likeData.push({
        postId: post.id,
        userId: user.id,
        createdAt:
          randomPastDate(180),
      });
    }

    const bookmarkUsers =
      sampleUnique(
        activeUsers,
        randomInt(
          0,
          Math.min(
            18,
            activeUsers.length,
          ),
        ),
      );

    for (const user of bookmarkUsers) {
      bookmarkData.push({
        postId: post.id,
        userId: user.id,
        createdAt:
          randomPastDate(180),
      });
    }
  }

  await prisma.postLike.createMany({
    data: likeData,
    skipDuplicates: true,
  });

  await prisma.postBookmark.createMany({
    data: bookmarkData,
    skipDuplicates: true,
  });

  return {
    publishedPosts,
    activeUsers,
  };
}

// ======================================================
// SEED COMMENTS
// ======================================================

async function seedComments(
  users: Awaited<
    ReturnType<typeof seedUsers>
  >,
  taxonomy: Awaited<
    ReturnType<typeof seedTaxonomy>
  >,
  publishedPosts: SeededPost[],
) {
  console.log(
    '💬 Đang tạo comment và reply...',
  );

  const activeUsers =
    users.allUsers.filter(
      (user) =>
        user.status === UserStatus.ACTIVE,
    );

  const commentRecords: Array<{
    id: number;
    postId: number;
    userId: number;
  }> = [];

  const commentPosts = sampleUnique(
    publishedPosts,
    Math.min(
      110,
      publishedPosts.length,
    ),
  );

  for (const post of commentPosts) {
    const isVietnamese =
      post.languageId ===
      taxonomy.vietnamese.id;

    const rootCommentCount =
      randomInt(2, 9);

    for (
      let rootIndex = 0;
      rootIndex < rootCommentCount;
      rootIndex += 1
    ) {
      const user = pick(activeUsers);

      const createdAt =
        randomPastDate(120);

      const rootComment =
        await prisma.comment.create({
          data: {
            postId: post.id,
            userId: user.id,
            content: pick(
              isVietnamese
                ? vietnameseComments
                : englishComments,
            ),
            createdAt,
          },
        });

      commentRecords.push({
        id: rootComment.id,
        postId: rootComment.postId,
        userId: rootComment.userId,
      });

      const replyCount =
        chance(0.65)
          ? randomInt(1, 3)
          : 0;

      const replyUsers =
        sampleUnique(
          activeUsers.filter(
            (candidate) =>
              candidate.id !== user.id,
          ),
          replyCount,
        );

      if (replyUsers.length > 0) {
        await prisma.comment.createMany({
          data: replyUsers.map(
            (replyUser, replyIndex) => ({
              postId: post.id,
              userId: replyUser.id,
              parentId: rootComment.id,
              content: pick(
                isVietnamese
                  ? vietnameseReplies
                  : englishReplies,
              ),
              createdAt: addHours(
                createdAt,
                replyIndex + 1,
              ),
            }),
          ),
        });
      }
    }
  }

  return commentRecords;
}

// ======================================================
// SEED ANALYTICS
// ======================================================

async function seedAnalytics(
  posts: SeededPost[],
): Promise<void> {
  console.log(
    '📊 Đang tạo metric và view log...',
  );

  const metricData: Array<{
    postId: number;
    metricDate: Date;
    viewCount: number;
    likeCount: number;
  }> = [];

  const viewLogData: Array<{
    postId: number;
    viewerKey: string;
    viewedAt: Date;
  }> = [];

  for (const post of posts) {
    for (
      let dayIndex = 0;
      dayIndex < CONFIG.metricsDays;
      dayIndex += 1
    ) {
      const metricDate =
        startOfUtcDay(
          daysAgo(dayIndex),
        );

      metricData.push({
        postId: post.id,
        metricDate,
        viewCount:
          randomInt(0, 160),
        likeCount:
          randomInt(0, 25),
      });
    }

    const logCount =
      randomInt(6, 25);

    for (
      let logIndex = 0;
      logIndex < logCount;
      logIndex += 1
    ) {
      viewLogData.push({
        postId: post.id,
        viewerKey: sha256(
          `viewer-${post.id}-${logIndex}`,
        ).slice(0, 64),
        viewedAt:
          randomPastDate(60),
      });
    }
  }

  await prisma.postDailyMetric.createMany({
    data: metricData,
    skipDuplicates: true,
  });

  await prisma.postViewLog.createMany({
    data: viewLogData,
  });
}

// ======================================================
// SEED REPORTS
// ======================================================

async function seedReports(
  users: Awaited<
    ReturnType<typeof seedUsers>
  >,
  publishedPosts: SeededPost[],
  commentRecords: Array<{
    id: number;
    postId: number;
    userId: number;
  }>,
): Promise<void> {
  console.log('🚨 Đang tạo report...');

  const activeUsers =
    users.allUsers.filter(
      (user) =>
        user.status === UserStatus.ACTIVE,
    );

  const reviewers = [
    users.superAdmin,
    ...users.moderators,
  ];

  const postReports = sampleUnique(
    publishedPosts,
    Math.min(
      65,
      publishedPosts.length,
    ),
  );

  const postReportData =
    postReports.map((post) => {
      const reporter = pick(
        activeUsers.filter(
          (user) =>
            user.id !== post.authorId,
        ),
      );

      const status =
        randomReportStatus();

      const reviewed =
        status !== ReportStatus.PENDING;

      const reviewer = reviewed
        ? pick(reviewers)
        : null;

      return {
        reporterId: reporter.id,
        targetType:
          ReportTargetType.POST,
        postId: post.id,
        commentId: null,
        reason: randomReportReason(),
        description:
          pick(reportDescriptions),
        status,
        reviewedById:
          reviewer?.id ?? null,
        reviewedAt: reviewed
          ? randomPastDate(20)
          : null,
        resolutionNote: reviewed
          ? status ===
            ReportStatus.RESOLVED
            ? 'Đã kiểm tra và xử lý nội dung.'
            : 'Báo cáo không đủ căn cứ.'
          : null,
        createdAt:
          randomPastDate(50),
      };
    });

  const selectedComments =
    sampleUnique(
      commentRecords,
      Math.min(
        45,
        commentRecords.length,
      ),
    );

  const commentReportData =
    selectedComments.map((comment) => {
      const reporter = pick(
        activeUsers.filter(
          (user) =>
            user.id !== comment.userId,
        ),
      );

      const status =
        randomReportStatus();

      const reviewed =
        status !== ReportStatus.PENDING;

      const reviewer = reviewed
        ? pick(reviewers)
        : null;

      return {
        reporterId: reporter.id,
        targetType:
          ReportTargetType.COMMENT,
        postId: null,
        commentId: comment.id,
        reason: randomReportReason(),
        description:
          pick(reportDescriptions),
        status,
        reviewedById:
          reviewer?.id ?? null,
        reviewedAt: reviewed
          ? randomPastDate(20)
          : null,
        resolutionNote: reviewed
          ? status ===
            ReportStatus.RESOLVED
            ? 'Bình luận đã được kiểm tra và xử lý.'
            : 'Không phát hiện vi phạm.'
          : null,
        createdAt:
          randomPastDate(50),
      };
    });

  await prisma.report.createMany({
    data: [
      ...postReportData,
      ...commentReportData,
    ],
  });
}

// ======================================================
// MAIN
// ======================================================

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV ===
    'production'
  ) {
    throw new Error(
      'Không được chạy seed reset dữ liệu trong production.',
    );
  }

  console.log(
    '🌱 Bắt đầu seed dữ liệu...',
  );

  await resetDatabase();

  const users = await seedUsers();

  const taxonomy =
    await seedTaxonomy();

  await seedUserRelations(users);

  const posts = await seedPosts(
    users,
    taxonomy,
  );

  const postRelations =
    await seedPostRelations(
      users,
      taxonomy,
      posts,
    );

  const comments =
    await seedComments(
      users,
      taxonomy,
      postRelations.publishedPosts,
    );

  await seedAnalytics(
    postRelations.publishedPosts,
  );

  await seedReports(
    users,
    postRelations.publishedPosts,
    comments,
  );

  const [
    userCount,
    postCount,
    publishedPostCount,
    categoryCount,
    tagCount,
    commentCount,
    likeCount,
    bookmarkCount,
    followCount,
    reportCount,
    metricCount,
    viewLogCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.post.count({
      where: {
        status: PostStatus.PUBLISH,
      },
    }),
    prisma.category.count(),
    prisma.tag.count(),
    prisma.comment.count(),
    prisma.postLike.count(),
    prisma.postBookmark.count(),
    prisma.userFollow.count(),
    prisma.report.count(),
    prisma.postDailyMetric.count(),
    prisma.postViewLog.count(),
  ]);

  console.log('');
  console.log('✅ Seed hoàn tất');
  console.log(
    `   Users: ${userCount}`,
  );
  console.log(
    `   Posts: ${postCount}`,
  );
  console.log(
    `   Published posts: ${publishedPostCount}`,
  );
  console.log(
    `   Categories: ${categoryCount}`,
  );
  console.log(
    `   Tags: ${tagCount}`,
  );
  console.log(
    `   Comments: ${commentCount}`,
  );
  console.log(
    `   Likes: ${likeCount}`,
  );
  console.log(
    `   Bookmarks: ${bookmarkCount}`,
  );
  console.log(
    `   Follows: ${followCount}`,
  );
  console.log(
    `   Reports: ${reportCount}`,
  );
  console.log(
    `   Daily metrics: ${metricCount}`,
  );
  console.log(
    `   View logs: ${viewLogCount}`,
  );

  console.log('');
  console.log(
    '🔐 Tài khoản kiểm thử:',
  );
  console.log(
    `   SUPER_ADMIN: super_admin / ${ADMIN_PASSWORD}`,
  );
  console.log(
    `   MODERATOR: moderator_001 / ${TEST_PASSWORD}`,
  );
  console.log(
    `   BLOG_OWNER: owner_001 / ${TEST_PASSWORD}`,
  );
  console.log(
    `   NORMAL: user_001 / ${TEST_PASSWORD}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      '❌ Seed thất bại:',
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });