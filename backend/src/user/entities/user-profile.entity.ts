import { Exclude, Expose } from 'class-transformer';
import type { User } from '@prisma/client';
import { UserEntity } from '@app/core';
import { UserFollowSummaryEntity } from './user-follow-summary.entity';

export type UserFollowerSummary = UserFollowSummaryEntity;

/**
 * Entity dành riêng cho User API (ví dụ: profile của người dùng).
 *
 * Kế thừa UserEntity từ core nhưng đảm bảo:
 * - Ẩn các trường kiểm duyệt nội bộ và xóa mềm: deletedAt, lockedById, lockedAt, lockReason
 * - Xem được danh sách những người đã follow mình (followers) đã qua lọc thông tin cơ bản
 */
export class UserProfileEntity extends UserEntity {
  /**
   * Ẩn trường xóa mềm khỏi response.
   */
  @Exclude()
  declare deletedAt: Date | null;

  /**
   * Ẩn ID moderator/người đã khóa tài khoản.
   */
  @Exclude()
  declare lockedById: number | null;

  /**
   * Ẩn thời gian khóa tài khoản nội bộ.
   */
  @Exclude()
  declare lockedAt: Date | null;

  /**
   * Ẩn lý do khóa tài khoản nội bộ.
   */
  @Exclude()
  declare lockReason: string | null;

  /**
   * Ẩn quan hệ thô từ Prisma (trong Prisma schema, quan hệ người khác follow mình là field 'following').
   */
  @Exclude()
  declare following?: any[];

  /**
   * Danh sách những người đã follow mình (followers).
   */
  @Expose()
  followers?: UserFollowerSummary[];

  constructor(
    partial: Partial<
      UserProfileEntity & { following?: any[]; followers?: any[] }
    >,
  ) {
    super(partial);
    Object.assign(this, partial);

    // Xử lý danh sách những người đã follow mình (từ dữ liệu thô Prisma 'following' hoặc truyền trực tiếp 'followers')
    const rawFollowersList = partial.followers ?? partial.following;
    if (Array.isArray(rawFollowersList)) {
      this.followers = rawFollowersList
        .map((item: unknown) => {
          // Trường hợp 1: Dữ liệu thô từ Prisma UserFollow { follower: { id, username, avatarUrl, bio } }
          if (
            item &&
            typeof item === 'object' &&
            'follower' in item &&
            item.follower
          ) {
            return new UserFollowSummaryEntity(item.follower);
          }
          // Trường hợp 2: Dữ liệu đã là đối tượng User { id, username, avatarUrl, bio }
          if (
            item &&
            typeof item === 'object' &&
            'id' in item &&
            'username' in item
          ) {
            return new UserFollowSummaryEntity(item as Partial<User>);
          }
          return null;
        })
        .filter((item): item is UserFollowSummaryEntity => item !== null);
    }
  }
}
