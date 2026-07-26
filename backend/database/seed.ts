import {
  MediaType,
  PostStatus,
  PrismaClient,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL chưa được cấu hình trong file .env');
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type CategoryTranslationSeed = {
  languageId: number;
  name: string;
};

type CategoryGroupSeed = {
  groupId: number;
  translations: CategoryTranslationSeed[];
};

function getUtcDateOnly(daysAgo = 0): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

async function upsertCategoryTranslation(params: {
  categoryGroupId: number;
  languageId: number;
  name: string;
}) {
  const { categoryGroupId, languageId, name } = params;

  const existingByGroup = await prisma.category.findUnique({
    where: {
      categoryGroupId_languageId: {
        categoryGroupId,
        languageId,
      },
    },
  });

  const existingByName = await prisma.category.findUnique({
    where: {
      name_languageId: {
        name,
        languageId,
      },
    },
  });

  // Cả hai unique đều trỏ tới cùng một bản ghi.
  if (
    existingByGroup &&
    existingByName &&
    existingByGroup.id === existingByName.id
  ) {
    return prisma.category.update({
      where: { id: existingByGroup.id },
      data: {
        name,
        deletedAt: null,
      },
    });
  }

  // Có hai bản ghi xung đột: giữ bản ghi thuộc đúng group.
  if (
    existingByGroup &&
    existingByName &&
    existingByGroup.id !== existingByName.id
  ) {
    const oldPostCategories = await prisma.postCategory.findMany({
      where: {
        categoryId: existingByName.id,
      },
      select: {
        postId: true,
      },
    });

    for (const relation of oldPostCategories) {
      await prisma.postCategory.upsert({
        where: {
          postId_categoryId: {
            postId: relation.postId,
            categoryId: existingByGroup.id,
          },
        },
        update: {},
        create: {
          postId: relation.postId,
          categoryId: existingByGroup.id,
        },
      });
    }

    await prisma.postCategory.deleteMany({
      where: {
        categoryId: existingByName.id,
      },
    });

    await prisma.category.delete({
      where: {
        id: existingByName.id,
      },
    });

    return prisma.category.update({
      where: {
        id: existingByGroup.id,
      },
      data: {
        name,
        deletedAt: null,
      },
    });
  }

  // Đã có một category ở đúng group và language.
  if (existingByGroup) {
    return prisma.category.update({
      where: {
        id: existingByGroup.id,
      },
      data: {
        name,
        deletedAt: null,
      },
    });
  }

  // Đã có đúng tên và language nhưng đang thuộc group cũ.
  if (existingByName) {
    return prisma.category.update({
      where: {
        id: existingByName.id,
      },
      data: {
        categoryGroupId,
        deletedAt: null,
      },
    });
  }

  // Chưa tồn tại.
  return prisma.category.create({
    data: {
      categoryGroupId,
      languageId,
      name,
    },
  });
}

async function main() {
  console.log('🌱 Bắt đầu bơm dữ liệu mẫu...');

  // ==============================================================
  // 1. MẬT KHẨU DÙNG CHUNG
  // ==============================================================
  const pepper = process.env.PASSWORD_PEPPER ?? '';

  const defaultPasswordHash = await bcrypt.hash(
    `password123${pepper}`,
    10,
  );

  // ==============================================================
  // 2. NGÔN NGỮ
  // ==============================================================
  console.log('⏳ Đang tạo Languages...');

  const langVi = await prisma.language.upsert({
    where: { code: 'vi' },
    update: {
      name: 'Tiếng Việt',
      flag: '🇻🇳',
      deletedAt: null,
    },
    create: {
      code: 'vi',
      name: 'Tiếng Việt',
      flag: '🇻🇳',
    },
  });

  const langEn = await prisma.language.upsert({
    where: { code: 'en' },
    update: {
      name: 'English',
      flag: '🇺🇸',
      deletedAt: null,
    },
    create: {
      code: 'en',
      name: 'English',
      flag: '🇺🇸',
    },
  });

  const langJa = await prisma.language.upsert({
    where: { code: 'ja' },
    update: {
      name: '日本語',
      flag: '🇯🇵',
      deletedAt: null,
    },
    create: {
      code: 'ja',
      name: '日本語',
      flag: '🇯🇵',
    },
  });

  const langKo = await prisma.language.upsert({
    where: { code: 'ko' },
    update: {
      name: '한국어',
      flag: '🇰🇷',
      deletedAt: null,
    },
    create: {
      code: 'ko',
      name: '한국어',
      flag: '🇰🇷',
    },
  });

  console.log(
    `✅ Languages: ${langVi.code}, ${langEn.code}, ${langJa.code}, ${langKo.code}`,
  );

  // ==============================================================
  // 3. CATEGORY GROUPS
  // ==============================================================
  console.log('⏳ Đang tạo Category Groups...');

  const groupTech = await prisma.categoryGroup.upsert({
    where: { code: 'technology' },
    update: { deletedAt: null },
    create: { code: 'technology' },
  });

  const groupLife = await prisma.categoryGroup.upsert({
    where: { code: 'lifestyle' },
    update: { deletedAt: null },
    create: { code: 'lifestyle' },
  });

  const groupPhone = await prisma.categoryGroup.upsert({
    where: { code: 'phone' },
    update: { deletedAt: null },
    create: { code: 'phone' },
  });

  const groupCar = await prisma.categoryGroup.upsert({
    where: { code: 'car' },
    update: { deletedAt: null },
    create: { code: 'car' },
  });

  // ==============================================================
  // 4. CATEGORIES ĐA NGÔN NGỮ
  // ==============================================================
  console.log('⏳ Đang tạo Categories...');

  const categorySeeds: CategoryGroupSeed[] = [
    {
      groupId: groupTech.id,
      translations: [
        { languageId: langVi.id, name: 'Công nghệ' },
        { languageId: langEn.id, name: 'Technology' },
        { languageId: langJa.id, name: 'テクノロジー' },
        { languageId: langKo.id, name: '기술' },
      ],
    },
    {
      groupId: groupLife.id,
      translations: [
        { languageId: langVi.id, name: 'Đời sống' },
        { languageId: langEn.id, name: 'Lifestyle' },
        { languageId: langJa.id, name: '暮らし' },
        { languageId: langKo.id, name: '라이프스타일' },
      ],
    },
    {
      groupId: groupPhone.id,
      translations: [
        { languageId: langVi.id, name: 'Điện thoại' },
        { languageId: langEn.id, name: 'Phone' },
        { languageId: langJa.id, name: '電話' },
        { languageId: langKo.id, name: '휴대폰' },
      ],
    },
    {
      groupId: groupCar.id,
      translations: [
        { languageId: langVi.id, name: 'Xe hơi' },
        { languageId: langEn.id, name: 'Car' },
        { languageId: langJa.id, name: '車' },
        { languageId: langKo.id, name: '자동차' },
      ],
    },
  ];

  for (const categorySeed of categorySeeds) {
    for (const translation of categorySeed.translations) {
      await upsertCategoryTranslation({
        categoryGroupId: categorySeed.groupId,
        languageId: translation.languageId,
        name: translation.name,
      });
    }
  }

  const catTechVi = await prisma.category.findUniqueOrThrow({
    where: {
      categoryGroupId_languageId: {
        categoryGroupId: groupTech.id,
        languageId: langVi.id,
      },
    },
  });

  const catPhoneVi = await prisma.category.findUniqueOrThrow({
    where: {
      categoryGroupId_languageId: {
        categoryGroupId: groupPhone.id,
        languageId: langVi.id,
      },
    },
  });

  // ==============================================================
  // 5. TAGS
  // ==============================================================
  console.log('⏳ Đang tạo Tags...');

  const tagNames = ['NestJS', 'Prisma', 'Backend', 'Database'];
  const tags: Array<{ id: number; name: string }> = [];

  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {
        deletedAt: null,
      },
      create: {
        name,
      },
      select: {
        id: true,
        name: true,
      },
    });

    tags.push(tag);
  }

  // ==============================================================
  // 6. USERS
  // ==============================================================
  console.log('⏳ Đang tạo Users...');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@system.local' },
    update: {
      username: 'superadmin',
      passwordHash: defaultPasswordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      bio: 'Quản trị viên tối cao của hệ thống.',
      deletedAt: null,
    },
    create: {
      username: 'superadmin',
      email: 'admin@system.local',
      passwordHash: defaultPasswordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      bio: 'Quản trị viên tối cao của hệ thống.',
    },
  });

  const moderatorUser = await prisma.user.upsert({
    where: { email: 'mod@system.local' },
    update: {
      username: 'moderator1',
      passwordHash: defaultPasswordHash,
      role: UserRole.CONTENT_MODERATOR,
      status: UserStatus.ACTIVE,
      bio: 'Người kiểm duyệt nội dung, giữ cho cộng đồng trong sạch.',
      deletedAt: null,
    },
    create: {
      username: 'moderator1',
      email: 'mod@system.local',
      passwordHash: defaultPasswordHash,
      role: UserRole.CONTENT_MODERATOR,
      status: UserStatus.ACTIVE,
      bio: 'Người kiểm duyệt nội dung, giữ cho cộng đồng trong sạch.',
    },
  });

  const blogOwnerUser = await prisma.user.upsert({
    where: { email: 'blogger@system.local' },
    update: {
      username: 'pro_blogger',
      passwordHash: defaultPasswordHash,
      role: UserRole.BLOG_OWNER,
      status: UserStatus.ACTIVE,
      bio: 'Chuyên gia viết bài công nghệ.',
      deletedAt: null,
    },
    create: {
      username: 'pro_blogger',
      email: 'blogger@system.local',
      passwordHash: defaultPasswordHash,
      role: UserRole.BLOG_OWNER,
      status: UserStatus.ACTIVE,
      bio: 'Chuyên gia viết bài công nghệ.',
    },
  });

  const normalUser = await prisma.user.upsert({
    where: { email: 'user@system.local' },
    update: {
      username: 'normal_user',
      passwordHash: defaultPasswordHash,
      role: UserRole.NORMAL,
      status: UserStatus.ACTIVE,
      bio: 'Người dùng đọc bài, thích bài và bình luận.',
      deletedAt: null,
    },
    create: {
      username: 'normal_user',
      email: 'user@system.local',
      passwordHash: defaultPasswordHash,
      role: UserRole.NORMAL,
      status: UserStatus.ACTIVE,
      bio: 'Người dùng đọc bài, thích bài và bình luận.',
    },
  });

  console.log(
    `✅ Users: ${adminUser.email}, ${moderatorUser.email}, ${blogOwnerUser.email}, ${normalUser.email}`,
  );

  // ==============================================================
  // 7. BÀI VIẾT MẪU
  // ==============================================================
  console.log('⏳ Đang tạo Bài viết mẫu...');

  const sampleTitle = 'Hướng dẫn toàn tập về Prisma và NestJS';

  let samplePost = await prisma.post.findFirst({
    where: {
      title: sampleTitle,
      authorId: blogOwnerUser.id,
      languageId: langVi.id,
      parentPostId: null,
    },
  });

  if (!samplePost) {
    samplePost = await prisma.post.create({
      data: {
        title: sampleTitle,
        content:
          'Đây là nội dung bài viết hướng dẫn chi tiết cách sử dụng Prisma trong môi trường NestJS...',
        status: PostStatus.PUBLISH,
        publishedAt: new Date(),
        authorId: blogOwnerUser.id,
        languageId: langVi.id,
        viewCount: 0,

        postCategories: {
          create: [
            { categoryId: catTechVi.id },
            { categoryId: catPhoneVi.id },
          ],
        },

        postTags: {
          create: tags.slice(0, 3).map((tag) => ({
            tagId: tag.id,
          })),
        },
      },
    });
  } else {
    samplePost = await prisma.post.update({
      where: { id: samplePost.id },
      data: {
        content:
          'Đây là nội dung bài viết hướng dẫn chi tiết cách sử dụng Prisma trong môi trường NestJS...',
        status: PostStatus.PUBLISH,
        publishedAt: samplePost.publishedAt ?? new Date(),
        deletedAt: null,

        postCategories: {
          deleteMany: {},
          create: [
            { categoryId: catTechVi.id },
            { categoryId: catPhoneVi.id },
          ],
        },

        postTags: {
          deleteMany: {},
          create: tags.slice(0, 3).map((tag) => ({
            tagId: tag.id,
          })),
        },
      },
    });
  }

  // Bảo đảm media mẫu không bị tạo trùng khi chạy seed nhiều lần.
  await prisma.media.deleteMany({
    where: {
      postId: samplePost.id,
      publicId: 'seed/prisma-nestjs',
    },
  });

  await prisma.media.create({
    data: {
      postId: samplePost.id,
      mediaType: MediaType.IMAGE,
      mediaUrl: 'https://example.com/images/prisma-nestjs.jpg',
      publicId: 'seed/prisma-nestjs',
    },
  });

  // ==============================================================
  // 8. LIKE VÀ COMMENT MẪU
  // ==============================================================
  await prisma.postLike.upsert({
    where: {
      postId_userId: {
        postId: samplePost.id,
        userId: normalUser.id,
      },
    },
    update: {},
    create: {
      postId: samplePost.id,
      userId: normalUser.id,
    },
  });

  const commentContent = 'Bài viết rất hay, cảm ơn tác giả!';

  const existingComment = await prisma.comment.findFirst({
    where: {
      postId: samplePost.id,
      userId: normalUser.id,
      content: commentContent,
    },
  });

  if (!existingComment) {
    await prisma.comment.create({
      data: {
        postId: samplePost.id,
        userId: normalUser.id,
        content: commentContent,
      },
    });
  }

  // ==============================================================
  // 9. THỐNG KÊ 7 NGÀY
  // ==============================================================
  console.log('⏳ Đang tạo thống kê 7 ngày...');

  const dailyViews = [12, 18, 23, 31, 27, 19, 20];
  const dailyLikes = [0, 0, 0, 0, 0, 0, 1];

  for (let index = 0; index < 7; index += 1) {
    const daysAgo = 6 - index;
    const metricDate = getUtcDateOnly(daysAgo);

    await prisma.postDailyMetric.upsert({
      where: {
        postId_metricDate: {
          postId: samplePost.id,
          metricDate,
        },
      },
      update: {
        viewCount: dailyViews[index],
        likeCount: dailyLikes[index],
      },
      create: {
        postId: samplePost.id,
        metricDate,
        viewCount: dailyViews[index],
        likeCount: dailyLikes[index],
      },
    });
  }

  const totalViewCount = dailyViews.reduce(
    (total, current) => total + current,
    0,
  );

  await prisma.post.update({
    where: {
      id: samplePost.id,
    },
    data: {
      viewCount: totalViewCount,
    },
  });

  // ==============================================================
  // 10. VIEW LOG MẪU
  // ==============================================================
  const viewerKey = `seed-user-${normalUser.id}`;

  const existingViewLog = await prisma.postViewLog.findFirst({
    where: {
      postId: samplePost.id,
      viewerKey,
    },
  });

  if (!existingViewLog) {
    await prisma.postViewLog.create({
      data: {
        postId: samplePost.id,
        viewerKey,
      },
    });
  }

  // ==============================================================
  // 11. REPORT MẪU
  // ==============================================================
  console.log('⏳ Đang tạo Báo cáo mẫu...');

  const existingReport = await prisma.report.findFirst({
    where: {
      reporterId: normalUser.id,
      postId: samplePost.id,
      reason: ReportReason.SPAM,
      status: ReportStatus.PENDING,
    },
  });

  if (!existingReport) {
    await prisma.report.create({
      data: {
        reporterId: normalUser.id,
        targetType: ReportTargetType.POST,
        postId: samplePost.id,
        reason: ReportReason.SPAM,
        description: 'Báo cáo mẫu để kiểm thử luồng Moderator.',
        status: ReportStatus.PENDING,
      },
    });
  }

  console.log('✅ Hoàn tất quá trình bơm dữ liệu mẫu!');
  console.log('Admin: admin@system.local / password123');
  console.log('Moderator: mod@system.local / password123');
  console.log('Blog Owner: blogger@system.local / password123');
  console.log('Normal User: user@system.local / password123');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Lỗi trong quá trình Seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
// import { PrismaClient, UserRole, UserStatus, PostStatus, MediaType, ReportReason, ReportTargetType, ReportStatus } from '@prisma/client';
// import * as bcrypt from 'bcrypt';
// import 'dotenv/config'; // Đọc file .env
// import { Pool } from 'pg';
// import { PrismaPg } from '@prisma/adapter-pg';

// const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// const adapter = new PrismaPg(pool);
// const prisma = new PrismaClient({ adapter });

// async function main() {
//     console.log('🌱 Bắt đầu bơm dữ liệu mẫu (Seeding)...');

//     // Mật khẩu chung cho tất cả các user mẫu là: 'password123'
//     // const defaultPasswordHash = await bcrypt.hash('password123', 10);
//     const pepper = process.env.PASSWORD_PEPPER || '';

//     const defaultPasswordHash = await bcrypt.hash(`password123${pepper}`,10);

//     // ==============================================================
//     // 1. NGÔN NGỮ (LANGUAGES)
//     // ==============================================================
//     console.log('⏳ Đang tạo Languages...');
//     const langVi = await prisma.language.upsert({
//         where: { code: 'vi' },
//         update: {},
//         create: { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
//     });

//     const langEn = await prisma.language.upsert({
//         where: { code: 'en' },
//         update: {},
//         create: { code: 'en', name: 'English', flag: '🇺🇸' },
//     });

//     // ==============================================================
//     // 2. NHÓM DANH MỤC (CATEGORY GROUPS)
//     // ==============================================================
//     console.log('⏳ Đang tạo Category Groups...');
//     const groupTech = await prisma.categoryGroup.upsert({
//         where: { code: 'technology' },
//         update: {},
//         create: { code: 'technology' },
//     });

//     const groupLife = await prisma.categoryGroup.upsert({
//         where: { code: 'lifestyle' },
//         update: {},
//         create: { code: 'lifestyle' },
//     });

//     // ==============================================================
//     // 3. DANH MỤC (CATEGORIES)
//     // ==============================================================
//     console.log('⏳ Đang tạo Categories...');
//     const catTechVi = await prisma.category.upsert({
//         // Sử dụng unique composite [name, languageId]
//         where: { name_languageId: { name: 'Công nghệ', languageId: langVi.id } },
//         update: {},
//         create: { name: 'Công nghệ', languageId: langVi.id, categoryGroupId: groupTech.id },
//     });

//     const catLifeVi = await prisma.category.upsert({
//         where: { name_languageId: { name: 'Đời sống', languageId: langVi.id } },
//         update: {},
//         create: { name: 'Đời sống', languageId: langVi.id, categoryGroupId: groupLife.id },
//     });

//     // ==============================================================
//     // 4. THẺ (TAGS)
//     // ==============================================================
//     console.log('⏳ Đang tạo Tags...');
//     const tagsToCreate = ['NestJS', 'Prisma', 'Backend', 'Database'];
//     for (const tagName of tagsToCreate) {
//         await prisma.tag.upsert({
//             where: { name: tagName },
//             update: {},
//             create: { name: tagName },
//         });
//     }

//     // ==============================================================
//     // 5. NGƯỜI DÙNG (USERS)
//     // ==============================================================
//     console.log('⏳ Đang tạo Users...');

//     // 4.1. Super Admin
//     const adminUser = await prisma.user.upsert({
//         where: { email: 'admin@system.local' },
//         update: {passwordHash: defaultPasswordHash},
//         create: {
//             username: 'superadmin',
//             email: 'admin@system.local',
//             passwordHash: defaultPasswordHash,
//             role: UserRole.SUPER_ADMIN,
//             status: UserStatus.ACTIVE,
//             bio: 'Quản trị viên tối cao của hệ thống.',
//         },
//     });

//     // 4.2. Content Moderator (Kiểm duyệt viên)
//     const moderatorUser = await prisma.user.upsert({
//         where: { email: 'mod@system.local' },
//         update: {},
//         create: {
//             username: 'moderator1',
//             email: 'mod@system.local',
//             passwordHash: defaultPasswordHash,
//             role: UserRole.CONTENT_MODERATOR,
//             status: UserStatus.ACTIVE,
//             bio: 'Người kiểm duyệt nội dung, giữ cho cộng đồng trong sạch.',
//         },
//     });

//     // 4.3. Blog Owner (Chủ blog)
//     const blogOwnerUser = await prisma.user.upsert({
//         where: { email: 'blogger@system.local' },
//         update: {},
//         create: {
//             username: 'pro_blogger',
//             email: 'blogger@system.local',
//             passwordHash: defaultPasswordHash,
//             role: UserRole.BLOG_OWNER,
//             status: UserStatus.ACTIVE,
//             bio: 'Chuyên gia viết bài công nghệ.',
//         },
//     });

//     // 4.4. Normal User (Người dùng bình thường)
//     const normalUser = await prisma.user.upsert({
//         where: { email: 'user@system.local' },
//         update: {},
//         create: {
//             username: 'normal_user',
//             email: 'user@system.local',
//             passwordHash: defaultPasswordHash,
//             role: UserRole.NORMAL,
//             status: UserStatus.ACTIVE,
//             bio: 'Chỉ vào đọc bài và bình luận dạo.',
//         },
//     });

//     // ==============================================================
//     // 6. BÀI VIẾT (POST) DÀNH CHO BLOG OWNER
//     // ==============================================================
//     console.log('⏳ Đang tạo Bài viết mẫu...');

//     // Dùng Tag vừa tạo
//     const techTag = await prisma.tag.findUnique({ where: { name: 'NestJS' } });

//     const samplePost = await prisma.post.create({
//         data: {
//             title: 'Hướng dẫn toàn tập về Prisma và NestJS',
//             content: 'Đây là nội dung bài viết hướng dẫn chi tiết cách sử dụng Prisma trong môi trường NestJS...',
//             status: PostStatus.PUBLISH,
//             authorId: blogOwnerUser.id,
//             categoryId: catTechVi.id,
//             languageId: langVi.id,
//             viewCount: 150,

//             // Tạo luôn liên kết với bảng Media, Tags, và Comment trong lúc tạo Post
//             media: {
//                 create: [
//                     {
//                         mediaType: MediaType.IMAGE,
//                         mediaUrl: 'https://example.com/images/prisma-nestjs.jpg',
//                     }
//                 ]
//             },
//             postTags: {
//                 create: techTag ? [{ tagId: techTag.id }] : []
//             },
//             comments: {
//                 create: [
//                     {
//                         userId: normalUser.id,
//                         content: 'Bài viết rất hay, cảm ơn tác giả!',
//                     }
//                 ]
//             }
//         }
//     });

//     // ==============================================================
//     // 7. BÁO CÁO (REPORT) MẪU
//     // ==============================================================
//     console.log('⏳ Đang tạo Báo cáo mẫu...');
//     await prisma.report.create({
//         data: {
//             reporterId: normalUser.id,
//             targetType: ReportTargetType.POST,
//             postId: samplePost.id,
//             reason: ReportReason.SPAM,
//             description: 'Tôi thấy bài viết này hơi spam',
//             status: ReportStatus.PENDING,
//         }
//     });

//     console.log('✅ Hoàn tất quá trình bơm dữ liệu mẫu!');
//     console.log('👤 Tài khoản test: admin@system.local / Mật khẩu: password123');
// }

// main()
//     .catch((e) => {
//         console.error('❌ Lỗi trong quá trình Seed:', e);
//         process.exit(1);
//     })
//     .finally(async () => {
//         await prisma.$disconnect();
//     });