import { Test, TestingModule } from '@nestjs/testing';
import { ModeratorApiController } from './moderator-api.controller';
import { ModeratorApiService } from './moderator-api.service';

describe('ModeratorApiController', () => {
  let moderatorApiController: ModeratorApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ModeratorApiController],
      providers: [ModeratorApiService],
    }).compile();

    moderatorApiController = app.get<ModeratorApiController>(ModeratorApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(moderatorApiController.getHello()).toBe('Hello World!');
    });
  });
});
