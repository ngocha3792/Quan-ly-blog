import { Module } from '@nestjs/common';

import {AuthsModule,PostsModule,} from '@app/core';

import { BlogownerOptionsController } from './controllers/blogowner-options.controller';
import { BlogownerPostsController } from './controllers/blogowner-posts.controller';

import { BlogownerOptionsService } from './services/blogowner-options.service';
import { BlogownerPostsService } from './services/blogowner-posts.service';

@Module({
  imports: [AuthsModule, PostsModule,],

  controllers: [BlogownerPostsController, BlogownerOptionsController,
  ],

  providers: [BlogownerPostsService,BlogownerOptionsService,],
})
export class BlogownerApiModule {}