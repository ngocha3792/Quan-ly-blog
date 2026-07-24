import { User, UserRole, UserStatus } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserEntity implements User {
    id: number;
    username: string;
    email: string;

    @Exclude() // 🛡️ Ẩn passwordHash khỏi Response
    passwordHash: string;

    role: UserRole;
    status: UserStatus;
    bio: string | null;
    avatarUrl: string | null;

    @Exclude() // 🛡️ Thông tin lock chỉ dành cho admin
    lockedAt: Date | null;

    @Exclude()
    lockedById: number | null;

    @Exclude()
    lockReason: string | null;

    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    deletedAt: Date | null;

    constructor(partial: Partial<UserEntity>) {
        Object.assign(this, partial);
    }
}
