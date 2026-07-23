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
    lockedAt: Date | null;
    lockedById: number | null;
    lockReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;

    constructor(partial: Partial<UserEntity>) {
        Object.assign(this, partial);
    }
}
