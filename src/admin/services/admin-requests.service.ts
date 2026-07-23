import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { BlogOwnerRequestsService } from '@app/core/modules/blog-owner-requests/blog-owner-requests.service';
import { UpdateBlogOwnerRequestDto } from '@app/core/modules/blog-owner-requests/dto';
import { BlogOwnerRequestStatus, UserRole } from '@prisma/client';

@Injectable()
export class AdminRequestsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly blogOwnerRequestsService: BlogOwnerRequestsService
    ) {}

    async updateRequestStatus(id: number, reviewerId: number, updateDto: UpdateBlogOwnerRequestDto) {
        // Find the request first to check its current status
        const request = await this.blogOwnerRequestsService.findOne(id);
        
        // Update the request using the core service
        const updatedRequest = await this.blogOwnerRequestsService.update(id, reviewerId, updateDto);

        // Cập nhật Role của User thành BLOG_OWNER nếu yêu cầu được duyệt
        if (updateDto.status === BlogOwnerRequestStatus.APPROVED && request.status !== BlogOwnerRequestStatus.APPROVED) {
            await this.prisma.user.update({
                where: { id: request.userId },
                data: { role: UserRole.BLOG_OWNER }
            });
        }

        return updatedRequest;
    }
}
