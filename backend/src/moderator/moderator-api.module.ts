import { Module } from '@nestjs/common';

import {
  AuthsModule,
  PostsModule,
  PrismaModule,
  ReportsModule,
} from '@app/core';

import { ModeratorCategoriesController } from './controllers/moderator-categories.controller';
import { ModeratorDashboardController } from './controllers/moderator-dashboard.controller';
import { ModeratorPostsController } from './controllers/moderator-posts.controller';
import { ModeratorReportsController } from './controllers/moderator-reports.controller';

import { ModeratorCategoriesService } from './services/moderator-categories.service';
import { ModeratorDashboardService } from './services/moderator-dashboard.service';
import { ModeratorPostsService } from './services/moderator-posts.service';
import { ModeratorReportsService } from './services/moderator-reports.service';
import { ModeratorCategoriesValidator } from './validators/moderator-categories.validator';

@Module({
  imports: [
    PrismaModule,
    AuthsModule,
    PostsModule,
    ReportsModule,
  ],

  controllers: [
    ModeratorPostsController,
    ModeratorReportsController,
    ModeratorCategoriesController,
    ModeratorDashboardController,
  ],

  providers: [
    ModeratorPostsService,
    ModeratorReportsService,
    ModeratorCategoriesService,
    ModeratorDashboardService,
    ModeratorCategoriesValidator,
  ],
})
export class ModeratorApiModule {}