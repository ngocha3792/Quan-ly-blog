import { Module } from '@nestjs/common';

import {
  AuthsModule,
  CloudinaryModule,
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
import { BlogownerPostHelperService } from './services/blogowner-post-helper.service';
import { BlogownerPostsService } from './services/blogowner-posts.service';
import { TranslationService } from './services/translation.service';

@Module({
  imports: [AuthsModule, PostsModule, MediaModule, CloudinaryModule],

  controllers: [
    BlogownerPostsController,
    BlogownerOptionsController,
    BlogownerDashboardController,
    BlogownerMediaController,
  ],

  providers: [
    BlogownerPostHelperService,
    BlogownerPostsService,
    BlogownerOptionsService,
    BlogownerDashboardService,
    BlogownerMediaService,
    TranslationService,
  ],
})
export class BlogownerApiModule {}
