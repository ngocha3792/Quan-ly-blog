import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { PostStatus, UserStatus, UserRole } from '@prisma/client';
import { UserNotFoundException, GetPostsDto } from '@app/core';
import type { PaginationParams } from '@app/core';
import { PostsPublicService } from './posts-public.service';

@Injectable()
export class UsersPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsPublicService: PostsPublicService,
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
        role: UserRole.BLOG_OWNER,
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

  async getTopAuthors(limit: number = 10) {
    // Gom nhóm theo followingId và đếm số lượng người follow
    const topFollows = await this.prisma.userFollow.groupBy({
      by: ['followingId'],
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

    if (topFollows.length > 0) {
      // Lấy thông tin user của các tác giả này
      const userIds = topFollows.map((f) => f.followingId);
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          status: UserStatus.ACTIVE,
          role: UserRole.BLOG_OWNER,
          deletedAt: null,
        },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          bio: true,
        },
      });

      // Map kết quả đếm và thông tin user, giữ nguyên thứ tự của topFollows
      const topAuthors = topFollows
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

      if (topAuthors.length > 0) {
        return topAuthors;
      }
    }

    // Khi không có tác giả nào có lượt follow, lấy danh sách tác giả active mặc định
    const fallbackUsers = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: UserRole.BLOG_OWNER,
        deletedAt: null,
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
      take: limit,
    });

    return fallbackUsers.map((user) => ({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followerCount: 0,
    }));
  }
}

