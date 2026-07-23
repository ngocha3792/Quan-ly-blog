import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/core/core/prisma/prisma.module';
import { LanguagesService } from './languages.service';

@Module({
  imports: [PrismaModule],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
