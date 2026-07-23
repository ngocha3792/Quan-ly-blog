import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateReportDto, UpdateReportDto, GetReportsDto } from './dto';
import { ReportEntity } from './entities/report.entity';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { Prisma, ReportStatus, ReportTargetType } from '@prisma/client';
import { ReportNotFoundException } from '@app/core/common/exceptions';

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(reporterId: number, createReportDto: CreateReportDto) {
        const report = await this.prisma.report.create({
            data: {
                ...createReportDto,
                reporterId,
            }
        });

        return new ReportEntity(report);
    }

    async findAll(query: GetReportsDto, paginationParams: PaginationParams): Promise<PaginatedResult<ReportEntity>> {
        const { targetType, status, reason, reporterId, postId, commentId } = query;
        const { skip, take, page } = paginationParams;

        const where: Prisma.ReportWhereInput = {};

        if (targetType) where.targetType = targetType;
        if (status) where.status = status;
        if (reason) where.reason = reason;
        if (reporterId) where.reporterId = reporterId;
        if (postId) where.postId = postId;
        if (commentId) where.commentId = commentId;

        const [reports, totalItems] = await Promise.all([
            this.prisma.report.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.report.count({ where }),
        ]);

        return {
            items: reports.map(report => new ReportEntity(report)),
            meta: {
                totalItems,
                itemCount: reports.length,
                itemsPerPage: take,
                totalPages: Math.ceil(totalItems / take),
                currentPage: page,
            }
        };
    }

    async findOne(id: number) {
        const report = await this.prisma.report.findUnique({
            where: { id }
        });

        if (!report) {
            throw new ReportNotFoundException(id.toString());
        }

        return new ReportEntity(report);
    }

    async update(id: number, reviewerId: number, updateReportDto: UpdateReportDto) {
        const report = await this.prisma.report.findUnique({
            where: { id }
        });

        if (!report) {
            throw new ReportNotFoundException(id.toString());
        }

        const updatedReport = await this.prisma.report.update({
            where: { id },
            data: {
                ...updateReportDto,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
            }
        });



        return new ReportEntity(updatedReport);
    }

    async remove(id: number) {
        await this.findOne(id);

        const deletedReport = await this.prisma.report.delete({
            where: { id }
        });

        return new ReportEntity(deletedReport);
    }
}
