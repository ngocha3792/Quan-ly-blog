import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard, RolesGuard } from '@app/core';
import type { PaginationParams } from '@app/core';

import { ModeratorCategoriesService } from '../services/moderator-categories.service';
import { ModeratorCategoriesController } from './moderator-categories.controller';

describe('ModeratorCategoriesController', () => {
  let controller: ModeratorCategoriesController;

  let moderatorCategoriesService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const pagination: PaginationParams = {
    skip: 0,
    take: 10,
    page: 1,
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    moderatorCategoriesService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [ModeratorCategoriesController],

      providers: [
        {
          provide: ModeratorCategoriesService,
          useValue: moderatorCategoriesService,
        },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })

      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })

      .compile();

    controller = module.get<ModeratorCategoriesController>(
      ModeratorCategoriesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return category groups', async () => {
    moderatorCategoriesService.findAll.mockResolvedValueOnce({
      items: [
        {
          id: 10,
          code: 'programming',
          translations: [],
        },
      ],

      meta: {
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      },
    });

    const query = {
      search: 'programming',
    };

    const result = await controller.findAll(query, pagination);

    expect(moderatorCategoriesService.findAll).toHaveBeenCalledWith(
      query,
      pagination,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].code).toBe('programming');
  });

  it('should return category group detail', async () => {
    moderatorCategoriesService.findOne.mockResolvedValueOnce({
      id: 10,
      code: 'programming',
      translationCount: 2,
      translations: [],
    });

    const result = await controller.findOne(10);

    expect(moderatorCategoriesService.findOne).toHaveBeenCalledWith(10);

    expect(result.id).toBe(10);
  });

  it('should create a multilingual category group', async () => {
    const dto = {
      code: 'programming',

      translations: [
        {
          languageId: 4,
          name: 'Lập trình',
        },
        {
          languageId: 1,
          name: 'Programming',
        },
      ],
    };

    moderatorCategoriesService.create.mockResolvedValueOnce({
      id: 10,
      code: 'programming',
      translationCount: 2,
    });

    const result = await controller.create(dto);

    expect(moderatorCategoriesService.create).toHaveBeenCalledWith(dto);

    expect(result.id).toBe(10);
    expect(result.translationCount).toBe(2);
  });

  it('should update a category group', async () => {
    const dto = {
      translations: [
        {
          languageId: 4,
          name: 'Lập trình Web',
        },
      ],
    };

    moderatorCategoriesService.update.mockResolvedValueOnce({
      id: 10,
      code: 'programming',
    });

    const result = await controller.update(10, dto);

    expect(moderatorCategoriesService.update).toHaveBeenCalledWith(10, dto);

    expect(result.id).toBe(10);
  });

  it('should remove a category group', async () => {
    moderatorCategoriesService.remove.mockResolvedValueOnce({
      id: 10,
      code: 'programming',
    });

    const result = await controller.remove(10);

    expect(moderatorCategoriesService.remove).toHaveBeenCalledWith(10);

    expect(result.id).toBe(10);
  });
});
