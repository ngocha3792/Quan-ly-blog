import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule, PrismaService } from '@app/core';

import { BlogownerApiModule } from './blogowner-api.module';
import { BlogownerDashboardController } from './controllers/blogowner-dashboard.controller';
import { BlogownerMediaController } from './controllers/blogowner-media.controller';
import { BlogownerOptionsController } from './controllers/blogowner-options.controller';
import { BlogownerPostsController } from './controllers/blogowner-posts.controller';
import { BlogownerDashboardService } from './services/blogowner-dashboard.service';
import { BlogownerMediaService } from './services/blogowner-media.service';
import { BlogownerOptionsService } from './services/blogowner-options.service';
import { BlogownerPostHelperService } from './services/blogowner-post-helper.service';
import { BlogownerPostsService } from './services/blogowner-posts.service';

describe('BlogownerApiModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        BlogownerApiModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        post: {},
        media: {},
        user: {},
        language: {},
        category: {},
        tag: {},
        $transaction: jest.fn(),
      })
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
    expect(module.get(BlogownerApiModule)).toBeDefined();
  });

  it('should resolve all controllers', () => {
    expect(module.get(BlogownerPostsController)).toBeDefined();
    expect(module.get(BlogownerOptionsController)).toBeDefined();
    expect(module.get(BlogownerDashboardController)).toBeDefined();
    expect(module.get(BlogownerMediaController)).toBeDefined();
  });

  it('should resolve all services', () => {
    expect(module.get(BlogownerPostHelperService)).toBeDefined();
    expect(module.get(BlogownerPostsService)).toBeDefined();
    expect(module.get(BlogownerOptionsService)).toBeDefined();
    expect(module.get(BlogownerDashboardService)).toBeDefined();
    expect(module.get(BlogownerMediaService)).toBeDefined();
  });
});
