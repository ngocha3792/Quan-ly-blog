import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloudinary: CloudinaryService
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleCron() {
        this.logger.log('Bắt đầu dọn dẹp dữ liệu xóa mềm (Soft-deleted) quá 30 ngày...');
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - 30);

        try {
            await this.cleanupMedia(thresholdDate);
            await this.cleanupOtherTables(thresholdDate);
            this.logger.log('Hoàn thành dọn dẹp dữ liệu xóa mềm.');
        } catch (error) {
            this.logger.error('Lỗi trong quá trình dọn dẹp:', error);
        }
    }

    private async cleanupMedia(thresholdDate: Date) {
        // Tìm các media bị xóa mềm quá 30 ngày
        const mediaToDelete = await this.prisma.media.findMany({
            where: {
                deletedAt: {
                    lte: thresholdDate,
                }
            }
        });

        if (mediaToDelete.length > 0) {
            this.logger.log(`Tìm thấy ${mediaToDelete.length} media cần xóa vĩnh viễn.`);
            
            // Xóa file trên Cloudinary
            for (const media of mediaToDelete) {
                if (media.publicId) {
                    try {
                        await this.cloudinary.deleteFile(media.publicId);
                    } catch (error) {
                        this.logger.error(`Không thể xóa ảnh trên Cloudinary với publicId: ${media.publicId}`, error);
                        // Vẫn tiếp tục xóa các file khác
                    }
                }
            }

            // Xóa vĩnh viễn trong DB
            const deleted = await this.prisma.media.deleteMany({
                where: {
                    deletedAt: {
                        lte: thresholdDate,
                    }
                }
            });
            this.logger.log(`Đã xóa vĩnh viễn ${deleted.count} bản ghi Media trong DB.`);
        }
    }

    private async cleanupOtherTables(thresholdDate: Date) {
        const whereClause = {
            deletedAt: {
                lte: thresholdDate,
            }
        };

        // Danh sách các bảng có deletedAt
        const tables = [
            { name: 'User', delegate: this.prisma.user },
            { name: 'Language', delegate: this.prisma.language },
            { name: 'Category', delegate: this.prisma.category },
            { name: 'Post', delegate: this.prisma.post },
            { name: 'Comment', delegate: this.prisma.comment },
            { name: 'Tag', delegate: this.prisma.tag },
        ];

        for (const table of tables) {
            const deleted = await (table.delegate as any).deleteMany({
                where: whereClause
            });
            if (deleted.count > 0) {
                this.logger.log(`Đã xóa vĩnh viễn ${deleted.count} bản ghi trong bảng ${table.name}.`);
            }
        }
    }
}
