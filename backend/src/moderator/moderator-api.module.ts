import { Module } from '@nestjs/common';

import {
  AuthsModule,
  PostsModule,
  PrismaModule,
  ReportsModule,
} from '@app/core';

import { ModeratorCategoriesController } from './controllers/moderator-categories.controller';
import { ModeratorPostsController } from './controllers/moderator-posts.controller';
import { ModeratorReportsController } from './controllers/moderator-reports.controller';

import { ModeratorCategoriesService } from './services/moderator-categories.service';
import { ModeratorPostsService } from './services/moderator-posts.service';
import { ModeratorReportsService } from './services/moderator-reports.service';

@Module({
  imports: [
    PrismaModule,
    AuthsModule,

    /**
     * Cung cấp PostsService cho ModeratorPostsService.
     */
    PostsModule,

    /**
     * Cung cấp ReportsService cho ModeratorReportsService.
     */
    ReportsModule,
  ],

  controllers: [
    ModeratorPostsController,
    ModeratorReportsController,
    ModeratorCategoriesController,
  ],

  providers: [
    ModeratorPostsService,
    ModeratorReportsService,
    ModeratorCategoriesService,
  ],
})
export class ModeratorApiModule {}