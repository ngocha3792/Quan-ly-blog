import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaModule } from '@app/core/core/prisma/prisma.module';

@Module({
    imports: [CloudinaryModule, PrismaModule],
    providers: [CleanupService],
})
export class CleanupModule {}
