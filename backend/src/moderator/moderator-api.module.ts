import { Module } from '@nestjs/common';

import {
  AuthsModule,
  PrismaModule,
} from '@app/core';

import { ModeratorPostsController } from './controllers/moderator-posts.controller';
import { ModeratorReportsController } from './controllers/moderator-reports.controller';

import { ModeratorPostsService } from './services/moderator-posts.service';
import { ModeratorReportsService } from './services/moderator-reports.service';

@Module({
  imports: [
    PrismaModule,
    AuthsModule,
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