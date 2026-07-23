import { Report, ReportTargetType, ReportReason, ReportStatus } from '@prisma/client';

export class ReportEntity implements Report {
    id: number;
    reporterId: number;
    targetType: ReportTargetType;
    postId: number | null;
    commentId: number | null;
    reason: ReportReason;
    description: string | null;
    status: ReportStatus;
    reviewedById: number | null;
    reviewedAt: Date | null;
    resolutionNote: string | null;
    createdAt: Date;
    updatedAt: Date;

    constructor(partial: Partial<ReportEntity>) {
        Object.assign(this, partial);
    }
}
