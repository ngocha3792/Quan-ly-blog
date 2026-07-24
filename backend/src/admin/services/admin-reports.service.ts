import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { ReportsService } from '@app/core/modules/reports/reports.service';
import { UpdateReportDto } from '@app/core/modules/reports/dto';
import { ReportStatus, ReportTargetType } from '@prisma/client';

@Injectable()
export class AdminReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reportsService: ReportsService
    ) {}

    async updateReportStatus(id: number, reviewerId: number, updateReportDto: UpdateReportDto) {
        // Find the report first to check its current status
        const report = await this.reportsService.findOne(id);
        
        // Update the report using the core service
        const updatedReport = await this.reportsService.update(id, reviewerId, updateReportDto);

        // Tự động xử lý Bài viết / Bình luận nếu báo cáo được Duyệt (RESOLVED)
        if (updateReportDto.status === ReportStatus.RESOLVED && report.status !== ReportStatus.RESOLVED) {
            if (report.targetType === ReportTargetType.POST && report.postId) {
                // Xóa mềm bài viết
                await this.prisma.post.update({
                    where: { id: report.postId },
                    data: { deletedAt: new Date() }
                }).catch(() => {});
            } else if (report.targetType === ReportTargetType.COMMENT && report.commentId) {
                // Xóa mềm bình luận
                await this.prisma.comment.update({
                    where: { id: report.commentId },
                    data: { deletedAt: new Date() }
                }).catch(() => {});
            }
        }

        return updatedReport;
    }
}
