import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { SelfActionNotAllowedException, ExistActionNotAllowedException, UserNotFoundException } from '@app/core/common/exceptions';

@Injectable()
export class UserFollowService {
    constructor(private readonly prisma: PrismaService) { }

    async followUser(followerId: number, followingId: number) {
        if (followerId === followingId) {
            throw new SelfActionNotAllowedException('follow');
        }

        const followingUser = await this.prisma.user.findFirst({
            where: {
                id: followingId,
                deletedAt: null
            },
        });
        
        if (!followingUser) {
            throw new UserNotFoundException(followingId.toString());
        }

        const existingFollow = await this.prisma.userFollow.findUnique({
            where: {
                followerId_followingId: {
                    followerId,
                    followingId,
                }
            }
        });

        if (existingFollow) {
            throw new ExistActionNotAllowedException('follow', followingId.toString());
        }

        const userFollow = await this.prisma.userFollow.create({
            data: {
                followerId,
                followingId,
            }
        });

        return userFollow;
    }

    async unfollowUser(followerId: number, followingId: number) {
        if (followerId === followingId) {
            throw new SelfActionNotAllowedException('unfollow');
        }

        const existingFollow = await this.prisma.userFollow.findUnique({
            where: {
                followerId_followingId: {
                    followerId,
                    followingId,
                }
            }
        });

        if (!existingFollow) {
            throw new ExistActionNotAllowedException('unfollow', followerId.toString());
        }

        await this.prisma.userFollow.delete({
            where: {
                followerId_followingId: {
                    followerId,
                    followingId,
                }
            }
        });

        return { success: true, message: 'Đã bỏ follow thành công' };
    }

    async getFollowerCount(userId: number): Promise<number> {
        return this.prisma.userFollow.count({
            where: { followingId: userId }
        });
    }

    async getFollowingCount(userId: number): Promise<number> {
        return this.prisma.userFollow.count({
            where: { followerId: userId }
        });
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

        if (topFollows.length === 0) return [];

        // Lấy thông tin user của các tác giả này
        const userIds = topFollows.map(f => f.followingId);
        const users = await this.prisma.user.findMany({
            where: { 
                id: { in: userIds },
                deletedAt: null // Chỉ lấy những user chưa bị xoá
            },
            select: {
                id: true,
                username: true,
                avatarUrl: true,
                bio: true,
            }
        });

        // Map kết quả đếm và thông tin user, giữ nguyên thứ tự của topFollows
        return topFollows.map(f => {
            const user = users.find(u => u.id === f.followingId);
            if (!user) return null;
            return {
                id: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl,
                bio: user.bio,
                followerCount: f._count.followingId,
            };
        }).filter(item => item !== null);
    }
}
