import { Module } from '@nestjs/common';

import {
  AuthsModule,
  MediaModule,
  PostsModule,
} from '@app/core';

import { BlogownerDashboardController } from './controllers/blogowner-dashboard.controller';
import { BlogownerMediaController } from './controllers/blogowner-media.controller';
import { BlogownerOptionsController } from './controllers/blogowner-options.controller';
import { BlogownerPostsController } from './controllers/blogowner-posts.controller';

import { BlogownerDashboardService } from './services/blogowner-dashboard.service';
import { BlogownerMediaService } from './services/blogowner-media.service';
import { BlogownerOptionsService } from './services/blogowner-options.service';
import { BlogownerPostsService } from './services/blogowner-posts.service';

@Module({
  imports: [
    AuthsModule,
    PostsModule,
    MediaModule,
  ],
  controllers: [
    BlogownerPostsController,
    BlogownerOptionsController,
    BlogownerDashboardController,
    BlogownerMediaController,
  ],
  providers: [
    BlogownerPostsService,
    BlogownerOptionsService,
    BlogownerDashboardService,
    BlogownerMediaService,
  ],
})
export class BlogownerApiModule {}