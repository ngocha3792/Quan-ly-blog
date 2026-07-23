import { PrismaClient, UserRole, UserStatus, PostStatus, MediaType, ReportReason, ReportTargetType, ReportStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config'; // Đọc file .env
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Bắt đầu bơm dữ liệu mẫu (Seeding)...');

    // Mật khẩu chung cho tất cả các user mẫu là: 'password123'
    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    // ==============================================================
    // 1. NGÔN NGỮ (LANGUAGES)
    // ==============================================================
    console.log('⏳ Đang tạo Languages...');
    const langVi = await prisma.language.upsert({
        where: { code: 'vi' },
        update: {},
        create: { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    });

    const langEn = await prisma.language.upsert({
        where: { code: 'en' },
        update: {},
        create: { code: 'en', name: 'English', flag: '🇺🇸' },
    });

    // ==============================================================
    // 2. DANH MỤC (CATEGORIES)
    // ==============================================================
    console.log('⏳ Đang tạo Categories...');
    const catTechVi = await prisma.category.upsert({
        // Sử dụng unique composite [name, languageId]
        where: { name_languageId: { name: 'Công nghệ', languageId: langVi.id } },
        update: {},
        create: { name: 'Công nghệ', languageId: langVi.id },
    });

    const catLifeVi = await prisma.category.upsert({
        where: { name_languageId: { name: 'Đời sống', languageId: langVi.id } },
        update: {},
        create: { name: 'Đời sống', languageId: langVi.id },
    });

    // ==============================================================
    // 3. THẺ (TAGS)
    // ==============================================================
    console.log('⏳ Đang tạo Tags...');
    const tagsToCreate = ['NestJS', 'Prisma', 'Backend', 'Database'];
    for (const tagName of tagsToCreate) {
        await prisma.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
        });
    }

    // ==============================================================
    // 4. NGƯỜI DÙNG (USERS)
    // ==============================================================
    console.log('⏳ Đang tạo Users...');

    // 4.1. Super Admin
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@system.local' },
        update: {},
        create: {
            username: 'superadmin',
            email: 'admin@system.local',
            passwordHash: defaultPasswordHash,
            role: UserRole.SUPER_ADMIN,
            status: UserStatus.ACTIVE,
            bio: 'Quản trị viên tối cao của hệ thống.',
        },
    });

    // 4.2. Content Moderator (Kiểm duyệt viên)
    const moderatorUser = await prisma.user.upsert({
        where: { email: 'mod@system.local' },
        update: {},
        create: {
            username: 'moderator1',
            email: 'mod@system.local',
            passwordHash: defaultPasswordHash,
            role: UserRole.CONTENT_MODERATOR,
            status: UserStatus.ACTIVE,
            bio: 'Người kiểm duyệt nội dung, giữ cho cộng đồng trong sạch.',
        },
    });

    // 4.3. Blog Owner (Chủ blog)
    const blogOwnerUser = await prisma.user.upsert({
        where: { email: 'blogger@system.local' },
        update: {},
        create: {
            username: 'pro_blogger',
            email: 'blogger@system.local',
            passwordHash: defaultPasswordHash,
            role: UserRole.BLOG_OWNER,
            status: UserStatus.ACTIVE,
            bio: 'Chuyên gia viết bài công nghệ.',
        },
    });

    // 4.4. Normal User (Người dùng bình thường)
    const normalUser = await prisma.user.upsert({
        where: { email: 'user@system.local' },
        update: {},
        create: {
            username: 'normal_user',
            email: 'user@system.local',
            passwordHash: defaultPasswordHash,
            role: UserRole.NORMAL,
            status: UserStatus.ACTIVE,
            bio: 'Chỉ vào đọc bài và bình luận dạo.',
        },
    });

    // ==============================================================
    // 5. BÀI VIẾT (POST) DÀNH CHO BLOG OWNER
    // ==============================================================
    console.log('⏳ Đang tạo Bài viết mẫu...');

    // Dùng Tag vừa tạo
    const techTag = await prisma.tag.findUnique({ where: { name: 'NestJS' } });

    const samplePost = await prisma.post.create({
        data: {
            title: 'Hướng dẫn toàn tập về Prisma và NestJS',
            content: 'Đây là nội dung bài viết hướng dẫn chi tiết cách sử dụng Prisma trong môi trường NestJS...',
            status: PostStatus.PUBLISH,
            authorId: blogOwnerUser.id,
            categoryId: catTechVi.id,
            languageId: langVi.id,
            viewCount: 150,

            // Tạo luôn liên kết với bảng Media, Tags, và Comment trong lúc tạo Post
            media: {
                create: [
                    {
                        mediaType: MediaType.IMAGE,
                        mediaUrl: 'https://example.com/images/prisma-nestjs.jpg',
                    }
                ]
            },
            postTags: {
                create: techTag ? [{ tagId: techTag.id }] : []
            },
            comments: {
                create: [
                    {
                        userId: normalUser.id,
                        content: 'Bài viết rất hay, cảm ơn tác giả!',
                    }
                ]
            }
        }
    });

    // ==============================================================
    // 6. BÁO CÁO (REPORT) MẪU
    // ==============================================================
    console.log('⏳ Đang tạo Báo cáo mẫu...');
    await prisma.report.create({
        data: {
            reporterId: normalUser.id,
            targetType: ReportTargetType.POST,
            postId: samplePost.id,
            reason: ReportReason.SPAM,
            description: 'Tôi thấy bài viết này hơi spam',
            status: ReportStatus.PENDING,
        }
    });

    console.log('✅ Hoàn tất quá trình bơm dữ liệu mẫu!');
    console.log('👤 Tài khoản test: admin@system.local / Mật khẩu: password123');
}

main()
    .catch((e) => {
        console.error('❌ Lỗi trong quá trình Seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });