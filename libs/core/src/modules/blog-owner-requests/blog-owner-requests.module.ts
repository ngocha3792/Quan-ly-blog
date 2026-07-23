import { Module } from '@nestjs/common';
import { BlogOwnerRequestsService } from './blog-owner-requests.service';

@Module({
  providers: [BlogOwnerRequestsService],
  exports: [BlogOwnerRequestsService],
})
export class BlogOwnerRequestsModule {}
