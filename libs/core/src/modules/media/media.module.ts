import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
