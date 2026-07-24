import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '@app/core/core/prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

describe('MediaService', () => {
    let service: MediaService;
    let prisma: PrismaService;

    const mockPrismaService = {};
    const mockCloudinaryService = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MediaService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CloudinaryService, useValue: mockCloudinaryService },
            ],
        }).compile();

        service = module.get<MediaService>(MediaService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
