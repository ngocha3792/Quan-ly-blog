import { Module } from '@nestjs/common';

import {
  AuthsModule,
  PostsModule,
  PrismaModule,
  ReportsModule,
} from '@app/core';

import { ModeratorPostsController } from './controllers/moderator-posts.controller';
import { ModeratorReportsController } from './controllers/moderator-reports.controller';

import { ModeratorPostsService } from './services/moderator-posts.service';
import { ModeratorReportsService } from './services/moderator-reports.service';

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
  ],

  providers: [
    ModeratorPostsService,
    ModeratorReportsService,
  ],
})
export class ModeratorApiModule {}