import { Test, TestingModule } from '@nestjs/testing';
import { BlogownerApiController } from './blogowner-api.controller';
import { BlogownerApiService } from './blogowner-api.service';

describe('BlogownerApiController', () => {
  let blogownerApiController: BlogownerApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [BlogownerApiController],
      providers: [BlogownerApiService],
    }).compile();

    blogownerApiController = app.get<BlogownerApiController>(BlogownerApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(blogownerApiController.getHello()).toBe('Hello World!');
    });
  });
});
