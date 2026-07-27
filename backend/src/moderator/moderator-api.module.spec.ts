import { Test, TestingModule } from '@nestjs/testing';

import { ModeratorApiModule } from './moderator-api.module';

describe('ModeratorApiModule', () => {
  let testingModule: TestingModule;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      imports: [ModeratorApiModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(testingModule).toBeDefined();
  });
});