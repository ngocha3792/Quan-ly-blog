import { Module } from '@nestjs/common';
import { BlogownerApiController } from './blogowner-api.controller';
import { BlogownerApiService } from './blogowner-api.service';

@Module({
  imports: [],
  controllers: [BlogownerApiController],
  providers: [BlogownerApiService],
})
export class BlogownerApiModule {}
