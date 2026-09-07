import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { LibreTranslateService } from './libre-translate.service';

@Module({
  imports: [ConfigModule],
  providers: [LibreTranslateService],
  exports: [LibreTranslateService],
})
export class TranslationModule {}