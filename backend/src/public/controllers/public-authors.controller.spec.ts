import { Test, TestingModule } from '@nestjs/testing';
import { PublicAuthorsController } from './public-authors.controller';
import { UsersPublicService } from '../services/users-public.service';
import { GetPostsDto } from '@app/core';

describe('PublicAuthorsController', () => {
  let controller: PublicAuthorsController;
  let usersPublicService: {
    getAuthorInfo: jest.Mock;
    getTopAuthors: jest.Mock;
  };

  beforeEach(async () => {
    usersPublicService = {
      getAuthorInfo: jest.fn(),
      getTopAuthors: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicAuthorsController],
      providers: [
        {
          provide: UsersPublicService,
          useValue: usersPublicService,
        },
      ],
    }).compile();

    controller = module.get<PublicAuthorsController>(PublicAuthorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTopAuthors', () => {
    it('should call getTopAuthors with limit', async () => {
      usersPublicService.getTopAuthors.mockResolvedValueOnce([
        { id: 1, username: 'author1', followerCount: 10 },
      ]);

      const result = await controller.getTopAuthors({ limit: 5 }, null);

      expect(usersPublicService.getTopAuthors).toHaveBeenCalledWith(5, null);
      expect(result).toEqual([
        { id: 1, username: 'author1', followerCount: 10 },
      ]);
    });
  });

  describe('getAuthorInfo', () => {
    it('should call getAuthorInfo with correct params', async () => {
      usersPublicService.getAuthorInfo.mockResolvedValueOnce({
        author: { id: 1, username: 'author1' },
        posts: [],
      });

      const query = new GetPostsDto();
      const pagination = { page: 1, skip: 0, take: 10 };

      const result = await controller.getAuthorInfo(1, query, pagination, 'vi');

      expect(usersPublicService.getAuthorInfo).toHaveBeenCalledWith(
        1,
        query,
        pagination,
        'vi',
      );
      expect(result.author.id).toBe(1);
    });
  });
});
