import { UserSession } from '@prisma/client';

export class UserSessionEntity implements UserSession {
    id: number;
    userId: number;
    refreshTokenHash: string;
    deviceInfo: string | null;
    ipAddress: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;

    constructor(partial: Partial<UserSessionEntity>) {
        Object.assign(this, partial);
    }
}
