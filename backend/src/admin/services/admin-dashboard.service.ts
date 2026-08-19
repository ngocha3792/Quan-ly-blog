import { Injectable } from '@nestjs/common';
import {
  PrismaService,
  getVietnamDayStartUtc,
  formatVietnamDate,
  getVietnamDateKey,
} from '@app/core';
import { UserRole, BlogOwnerRequestStatus, PostStatus } from '@prisma/client';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tổng hợp dữ liệu thống kê cho Admin Dashboard:
   * - 4 thẻ thống kê chính: totalUsers, totalBlogOwners, totalLanguages, pendingRequests
   * - Biểu đồ tăng trưởng người dùng 7 ngày gần nhất
   * - Biểu đồ phân bổ bài viết theo từng ngôn ngữ
   */
  async getDashboard() {
    const startDate = getVietnamDayStartUtc(-6);
    const endDate = getVietnamDayStartUtc(1);

    const [
      totalUsers,
      totalBlogOwners,
      totalLanguages,
      pendingRequests,
      recentUsers,
      languagesWithPostCount,
    ] = await this.prisma.$transaction([
      // 1. Tổng số Users
      this.prisma.user.count({ where: { deletedAt: null } }),

      // 2. Tổng số Blog Owners
      this.prisma.user.count({
        where: { role: UserRole.BLOG_OWNER, deletedAt: null },
      }),

      // 3. Tổng số ngôn ngữ đang hoạt động
      this.prisma.language.count({
        where: { deletedAt: null, isActive: true },
      }),

      // 4. Số yêu cầu Blog Owner chờ xử lý
      this.prisma.blogOwnerRequest.count({
        where: { status: BlogOwnerRequestStatus.PENDING },
      }),

      // 5. Danh sách người dùng mới trong 7 ngày gần nhất
      this.prisma.user.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
          deletedAt: null,
        },
        select: {
          createdAt: true,
        },
      }),

      // 6. Phân bổ bài viết xuất bản theo từng ngôn ngữ
      this.prisma.language.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          flag: true,
          _count: {
            select: {
              posts: {
                where: {
                  status: PostStatus.PUBLISH,
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
    ]);

    // Tính toán biểu đồ tăng trưởng người dùng 7 ngày
    const userCountByDate = new Map<string, number>();
    for (const user of recentUsers) {
      const dateKey = formatVietnamDate(user.createdAt);
      userCountByDate.set(dateKey, (userCountByDate.get(dateKey) ?? 0) + 1);
    }

    const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const userGrowthDays = Array.from({ length: 7 }, (_, index) => {
      const dateKey = getVietnamDateKey(-6 + index);
      const dateObj = new Date(dateKey);
      const dayOfWeek = (dateObj.getUTCDay() + 6) % 7; // Map 1->0 (T2), 0->6 (CN)
      const label = dayLabels[dayOfWeek] ?? dateKey;
      const count = userCountByDate.get(dateKey) ?? 0;

      return {
        date: dateKey,
        label,
        count,
      };
    });

    // Tính toán biểu đồ phân bổ bài viết theo ngôn ngữ
    const totalPublishedPosts = languagesWithPostCount.reduce(
      (sum, lang) => sum + lang._count.posts,
      0,
    );

    const postsByLanguageDetails = languagesWithPostCount.map((lang) => {
      const postCount = lang._count.posts;
      const percentage =
        totalPublishedPosts > 0
          ? Number(((postCount / totalPublishedPosts) * 100).toFixed(1))
          : 0;

      return {
        id: lang.id,
        name: lang.name,
        code: lang.code,
        flag: lang.flag,
        postCount,
        percentage,
      };
    });

    return {
      stats: {
        totalUsers,
        totalBlogOwners,
        totalLanguages,
        pendingRequests,
      },
      userGrowth: {
        labels: userGrowthDays.map((d) => d.label),
        data: userGrowthDays.map((d) => d.count),
        details: userGrowthDays,
      },
      postsByLanguage: {
        labels: postsByLanguageDetails.map((l) => l.name),
        data: postsByLanguageDetails.map((l) => l.postCount),
        details: postsByLanguageDetails,
      },
    };
  }
}
