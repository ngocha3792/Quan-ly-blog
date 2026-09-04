import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostStatus, UserStatus, UserRole, Prisma } from '@prisma/client';
import {
  UserNotFoundException,
  GetPostsDto,
  LanguagesService,
} from '@app/core';
import type { PaginationParams } from '@app/core';
import { PostsPublicService } from './posts-public.service';

// Vai trò được tính là "tác giả" ở public API: Blog Owner và các vai trò
// cao hơn (Content Moderator, Super Admin) khi họ có bài viết — không chỉ
// riêng Blog Owner. NORMAL không đăng bài được nên không có mặt ở đây.
const AUTHOR_ELIGIBLE_ROLES: UserRole[] = [
  UserRole.BLOG_OWNER,
  UserRole.CONTENT_MODERATOR,
  UserRole.SUPER_ADMIN,
];

@Injectable()
export class UsersPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsPublicService: PostsPublicService,
    private readonly languagesService: LanguagesService,
  ) {}

  async getAuthorInfo(
    authorId: number,
    query: GetPostsDto = new GetPostsDto(),
    paginationParams: PaginationParams = { page: 1, skip: 0, take: 10 },
    langCode: string | null = null,
  ) {
    const author = await this.prisma.user.findUnique({
      where: {
        id: authorId,
        status: UserStatus.ACTIVE,
        role: { in: AUTHOR_ELIGIBLE_ROLES },
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
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
    });

    if (!author) {
      throw new UserNotFoundException(authorId.toString());
    }

    const authorInfo = {
      id: author.id,
      username: author.username,
      bio: author.bio,
      avatarUrl: author.avatarUrl,
      createdAt: author.createdAt,
      postCount: author._count.posts,
    };

    // Tạo query mới với authorId, tránh mutate object gốc
    const authorQuery = { ...query, authorId };
    const posts = await this.postsPublicService.findAll(
      authorQuery,
      paginationParams,
      langCode,
    );

    return {
      author: authorInfo,
      posts: posts,
    };
  }

  async getTopAuthors(limit: number = 10, langCode: string | null = null) {
    let languageUserFilter: Prisma.UserWhereInput = {};

    if (langCode) {
      const languageId =
        await this.languagesService.getActiveIdByCode(langCode);

      if (!languageId) {
        return [];
      }

      languageUserFilter = {
        posts: {
          some: {
            languageId,
            language: {
              is: {
                isActive: true,
                deletedAt: null,
              },
            },
            status: PostStatus.PUBLISH,
            deletedAt: null,
          },
        },
      };
    }

    const whereAuthorCondition: Prisma.UserWhereInput = {
      status: UserStatus.ACTIVE,
      role: { in: AUTHOR_ELIGIBLE_ROLES },
      deletedAt: null,
      ...languageUserFilter,
    };

    // Gom nhóm theo followingId và đếm số lượng người follow của các tác giả hợp lệ
    const topFollows = await this.prisma.userFollow.groupBy({
      by: ['followingId'],
      where: {
        following: whereAuthorCondition,
      },
      _count: {
        followingId: true,
      },
      orderBy: {
        _count: {
          followingId: 'desc',
        },
      },
      take: limit,
    });

    let topAuthors: {
      id: number;
      username: string;
      avatarUrl: string | null;
      bio: string | null;
      followerCount: number;
    }[] = [];

    if (topFollows.length > 0) {
      // Lấy thông tin user của các tác giả này
      const userIds = topFollows.map((f) => f.followingId);
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          ...whereAuthorCondition,
        },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          bio: true,
        },
      });

      // Map kết quả đếm và thông tin user, giữ nguyên thứ tự của topFollows
      topAuthors = topFollows
        .map((f) => {
          const user = users.find((u) => u.id === f.followingId);
          if (!user) return null;
          return {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            followerCount: f._count.followingId,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }

    // Nếu đã có đủ tác giả theo limit thì trả về ngay
    if (topAuthors.length >= limit) {
      return topAuthors;
    }

    // Ngược lại, nếu chưa đủ limit, bù thêm các tác giả active khác
    const existingIds = topAuthors.map((a) => a.id);
    const needed = limit - topAuthors.length;

    const fallbackUsers =
      (await this.prisma.user.findMany({
        where: {
          ...whereAuthorCondition,
          ...(existingIds.length > 0 ? { id: { notIn: existingIds } } : {}),
        },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          bio: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: needed,
      })) ?? [];

    const fallbackAuthors = fallbackUsers.map((user) => ({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followerCount: 0,
    }));

    return [...topAuthors, ...fallbackAuthors];
  }
}
