import { Module } from '@nestjs/common';

import {
  AuthsModule,
  PostsModule,
} from '@app/core';

import { BlogownerDashboardController } from './controllers/blogowner-dashboard.controller';
import { BlogownerOptionsController } from './controllers/blogowner-options.controller';
import { BlogownerPostsController } from './controllers/blogowner-posts.controller';

import { BlogownerDashboardService } from './services/blogowner-dashboard.service';
import { BlogownerOptionsService } from './services/blogowner-options.service';
import { BlogownerPostsService } from './services/blogowner-posts.service';

@Module({
  imports: [
    AuthsModule,
    PostsModule,
  ],

  controllers: [
    BlogownerPostsController,
    BlogownerOptionsController,
    BlogownerDashboardController,
  ],

  providers: [
    BlogownerPostsService,
    BlogownerOptionsService,
    BlogownerDashboardService,
  ],
})
export class BlogownerApiModule {}