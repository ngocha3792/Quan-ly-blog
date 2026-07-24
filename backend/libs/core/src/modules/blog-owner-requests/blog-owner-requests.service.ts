import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CreateBlogOwnerRequestDto, UpdateBlogOwnerRequestDto, GetBlogOwnerRequestsDto } from './dto';
import { BlogOwnerRequestEntity } from './entities/blog-owner-request.entity';
import { PaginationParams, PaginatedResult } from '@app/core/common/interfaces';
import { Prisma, BlogOwnerRequestStatus, UserRole } from '@prisma/client';
import { BlogOwnerRequestNotFoundException, ExistActionNotAllowedException } from '@app/core/common/exceptions';

@Injectable()
export class BlogOwnerRequestsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: number, createDto: CreateBlogOwnerRequestDto) {
        // Kiểm tra xem user có đang có yêu cầu nào chờ duyệt (PENDING) không
        const existingPending = await this.prisma.blogOwnerRequest.findFirst({
            where: {
                userId,
                status: BlogOwnerRequestStatus.PENDING
            }
        });

        if (existingPending) {
            throw new ExistActionNotAllowedException('gửi yêu cầu (bạn đang có một yêu cầu chờ duyệt)', userId.toString());
        }

        const request = await this.prisma.blogOwnerRequest.create({
            data: {
                ...createDto,
                userId,
                status: BlogOwnerRequestStatus.PENDING, // Luôn mặc định là PENDING khi vừa tạo
            }
        });

        return new BlogOwnerRequestEntity(request);
    }

    async findAll(query: GetBlogOwnerRequestsDto, paginationParams: PaginationParams): Promise<PaginatedResult<BlogOwnerRequestEntity>> {
        const { userId, status } = query;
        const { skip, take, page } = paginationParams;

        const where: Prisma.BlogOwnerRequestWhereInput = {};

        if (userId) where.userId = userId;
        if (status) where.status = status;

        const [requests, totalItems] = await Promise.all([
            this.prisma.blogOwnerRequest.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.blogOwnerRequest.count({ where }),
        ]);

        return {
            items: requests.map(req => new BlogOwnerRequestEntity(req)),
            meta: {
                totalItems,
                itemCount: requests.length,
                itemsPerPage: take,
                totalPages: Math.ceil(totalItems / take),
                currentPage: page,
            }
        };
    }

    async findOne(id: number) {
        const request = await this.prisma.blogOwnerRequest.findUnique({
            where: { id }
        });

        if (!request) {
            throw new BlogOwnerRequestNotFoundException(id.toString());
        }

        return new BlogOwnerRequestEntity(request);
    }

    async update(id: number, reviewerId: number, updateDto: UpdateBlogOwnerRequestDto) {
        const request = await this.findOne(id); // Kích hoạt Exception nếu không tồn tại

        const updatedRequest = await this.prisma.blogOwnerRequest.update({
            where: { id },
            data: {
                ...updateDto,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
            }
        });



        return new BlogOwnerRequestEntity(updatedRequest);
    }

    async remove(id: number) {
        await this.findOne(id);

        const deletedRequest = await this.prisma.blogOwnerRequest.delete({
            where: { id }
        });

        return new BlogOwnerRequestEntity(deletedRequest);
    }
}
