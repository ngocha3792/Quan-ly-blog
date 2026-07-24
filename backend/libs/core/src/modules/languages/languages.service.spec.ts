import { Test, TestingModule } from '@nestjs/testing';
import { LanguagesService } from './languages.service';

import { PrismaService } from '@app/core/core/prisma/prisma.service';

describe('LanguagesService', () => {
    let service: LanguagesService;

    const mockPrismaService = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LanguagesService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<LanguagesService>(LanguagesService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
