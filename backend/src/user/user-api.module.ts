import { Module } from '@nestjs/common';

import {
  AuthsModule,
  BlogOwnerRequestsModule,
  CloudinaryModule,
  CommentsModule,
  PrismaModule,
  ReportsModule,
  UsersModule,
} from '@app/core';

import { UserAuthController } from './controllers/user-auth.controller';
import { UserBlogOwnerRequestsController } from './controllers/user-blog-owner-requests.controller';
import { UserCommentsController } from './controllers/user-comments.controller';
import { UserFollowController } from './controllers/user-follow.controller';
import { UserPostsController } from './controllers/user-posts.controller';
import { UserProfileController } from './controllers/user-profile.controller';
import { UserReportsController } from './controllers/user-reports.controller';

import { PostInteractionService } from './services/post-interaction.service';
import { UserBlogOwnerRequestsService } from './services/user-blog-owner-requests.service';
import { UserCommentsService } from './services/user-comments.service';
import { UserFollowService } from './services/user-follow.service';
import { UserProfileService } from './services/user-profile.service';
import { UserReportsService } from './services/user-reports.service';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthsModule,
    CommentsModule,
    ReportsModule,
    CloudinaryModule,
    BlogOwnerRequestsModule,
  ],

  controllers: [
    UserProfileController,
    UserAuthController,
    UserCommentsController,
    UserReportsController,
    UserFollowController,
    UserPostsController,
    UserBlogOwnerRequestsController,
  ],

  providers: [
    UserReportsService,
    UserProfileService,
    UserFollowService,
    PostInteractionService,
    UserBlogOwnerRequestsService,
    UserCommentsService,
  ],
})
export class UserApiModule {}