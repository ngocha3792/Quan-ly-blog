import { Module } from '@nestjs/common';

import {
  AuthsModule,
  PrismaModule,
} from '@app/core';

import { ModeratorPostsController } from './controllers/moderator-posts.controller';
import { ModeratorPostsService } from './services/moderator-posts.service';

@Module({
  imports: [
    PrismaModule,
    AuthsModule,
  ],

  controllers: [
    ModeratorPostsController,
  ],

  providers: [
    ModeratorPostsService,
  ],
})
export class ModeratorApiModule {}