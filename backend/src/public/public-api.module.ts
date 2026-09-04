import { Module } from '@nestjs/common';

import {
  UsersModule,
  PrismaModule,
  PostsModule,
  CategoriesModule,
  AuthsModule,
  TagsModule,
  LanguagesModule,
  SearchModule,
} from '@app/core';

import { PublicUsersController } from './controllers/public-users.controller';
import { PublicPostsController } from './controllers/public-posts.controller';
import { PublicTagsController } from './controllers/public-tags.controller';
import { PublicCategoriesController } from './controllers/public-categories.controller';
import { PublicAuthorsController } from './controllers/public-authors.controller';
import { PublicCommentsController } from './controllers/public-comments.controller';
import { PublicLanguagesController } from './controllers/public-languages.controller';
import { PublicSearchController } from './controllers/public-search.controller';

import { PostsPublicService } from './services/posts-public.service';
import { TagsPublicService } from './services/tags-public.service';
import { CategoriesPublicService } from './services/categories-public.service';
import { UsersPublicService } from './services/users-public.service';
import { CommentsPublicService } from './services/comments-public.service';
import { LanguagesPublicService } from './services/languages-public.service';
import { PublicSearchService } from './services/public-search.service';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    PostsModule,
    CategoriesModule,
    AuthsModule,
    TagsModule,
    LanguagesModule,
    SearchModule,
  ],

  controllers: [
    PublicUsersController,
    PublicPostsController,
    PublicTagsController,
    PublicCategoriesController,
    PublicAuthorsController,
    PublicCommentsController,
    PublicLanguagesController,
    PublicSearchController,
  ],

  providers: [
    PostsPublicService,
    TagsPublicService,
    CategoriesPublicService,
    UsersPublicService,
    CommentsPublicService,
    LanguagesPublicService,
    PublicSearchService,
  ],
})
export class PublicApiModule {}