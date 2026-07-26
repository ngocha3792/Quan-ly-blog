import { Module } from '@nestjs/common';

import { AuthsModule, PostsModule } from '@app/core';

import { BlogownerPostsController } from './controllers/blogowner-posts.controller';
import { BlogownerPostsService } from './services/blogowner-posts.service';

@Module({
  imports: [AuthsModule, PostsModule],

  controllers: [BlogownerPostsController],

  providers: [BlogownerPostsService],
})
export class BlogownerApiModule {}
