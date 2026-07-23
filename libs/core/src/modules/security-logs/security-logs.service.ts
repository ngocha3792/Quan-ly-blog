import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateSecurityLogDto, GetSecurityLogsDto } from './dto';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { SecurityLogEntity } from './entities/security-log.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class SecurityLogsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(createDto: CreateSecurityLogDto) {
        return this.prisma.securityLog.create({
            data: {
                userId: createDto.userId,
                ipAddress: createDto.ipAddress,
                action: createDto.action,
                userAgent: createDto.userAgent,
            }
        });
    }

    async findAll(query: GetSecurityLogsDto, paginationParams: PaginationParams): Promise<PaginatedResult<SecurityLogEntity>> {
        const { userId, action, ipAddress } = query;
        const { skip, take, page } = paginationParams;

        const where: Prisma.SecurityLogWhereInput = {};
        if (userId) where.userId = userId;
        if (action) where.action = { contains: action, mode: 'insensitive' };
        if (ipAddress) where.ipAddress = { contains: ipAddress, mode: 'insensitive' };

        const [data, totalItems] = await Promise.all([
            this.prisma.securityLog.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                        }
                    }
                }
            }),
            this.prisma.securityLog.count({ where })
        ]);

        return {
            items: data.map(item => new SecurityLogEntity(item)),
            meta: {
                totalItems,
                itemCount: data.length,
                itemsPerPage: take,
                totalPages: Math.ceil(totalItems / take),
                currentPage: page,
            }
        };
    }

    async findOne(id: number) {
        const log = await this.prisma.securityLog.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    }
                }
            }
        });

        if (!log) {
            throw new NotFoundException(`Không tìm thấy Security Log với id ${id}`);
        }
        return log;
    }

    // Ghi chú: Security logs thông thường không nên có tính năng sửa/xóa 
    // để đảm bảo tính toàn vẹn của lịch sử hệ thống (audit trail).
    // Vì vậy hàm update và remove không được triển khai ở đây.
}
