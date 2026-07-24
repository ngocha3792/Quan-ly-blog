import { SecurityLog } from '@prisma/client';

export class SecurityLogEntity implements SecurityLog {
    id: number;
    userId: number | null;
    ipAddress: string;
    action: string;
    userAgent: string | null;
    createdAt: Date;

    constructor(partial: Partial<SecurityLogEntity>) {
        Object.assign(this, partial);
    }
}
