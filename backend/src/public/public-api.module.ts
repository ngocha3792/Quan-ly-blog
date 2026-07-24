import { Module } from '@nestjs/common';

import { UsersModule, PrismaModule, PostsModule, CategoriesModule, AuthsModule, TagsModule } from '@app/core';
import { PublicUsersController } from './controllers/public-users.controller';
import { PublicPostsController } from './controllers/public-posts.controller';
import { PublicTagsController } from './controllers/public-tags.controller';
import { PublicCategoriesController } from './controllers/public-categories.controller';
import { PostsPublicService } from './services/posts-public.service';
import { TagsPublicService } from './services/tags-public.service';
import { CategoriesPublicService } from './services/categories-public.service';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    PostsModule,
    CategoriesModule,
    AuthsModule,
    TagsModule,
  ],
  controllers: [PublicUsersController, PublicPostsController, PublicTagsController, PublicCategoriesController],
  providers: [PostsPublicService, TagsPublicService, CategoriesPublicService],
})
export class PublicApiModule {}
