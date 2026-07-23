import { PasswordResetToken } from '@prisma/client';

export class PasswordResetTokenEntity implements PasswordResetToken {
    id: number;
    userId: number;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;

    constructor(partial: Partial<PasswordResetTokenEntity>) {
        Object.assign(this, partial);
    }
}
