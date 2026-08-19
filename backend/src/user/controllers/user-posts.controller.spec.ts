import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '@app/core';
import { UserPostsController } from './user-posts.controller';
import { PostInteractionService } from '../services/post-interaction.service';

describe('UserPostsController', () => {
  let controller: UserPostsController;
  let postInteractionService: {
    getBookmarkedPosts: jest.Mock;
    getLikedPosts: jest.Mock;
    bookmarkPost: jest.Mock;
    unbookmarkPost: jest.Mock;
    likePost: jest.Mock;
    unlikePost: jest.Mock;
  };

  beforeEach(async () => {
    postInteractionService = {
      getBookmarkedPosts: jest.fn(),
      getLikedPosts: jest.fn(),
      bookmarkPost: jest.fn(),
      unbookmarkPost: jest.fn(),
      likePost: jest.fn(),
      unlikePost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserPostsController],
      providers: [
        {
          provide: PostInteractionService,
          useValue: postInteractionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<UserPostsController>(UserPostsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getBookmarkedPosts', () => {
    it('should call getBookmarkedPosts with current user ID', async () => {
      const mockResult = { items: [], meta: {} as any };
      postInteractionService.getBookmarkedPosts.mockResolvedValueOnce(mockResult);

      const result = await controller.getBookmarkedPosts({ id: 1 } as any, {} as any);
      expect(postInteractionService.getBookmarkedPosts).toHaveBeenCalledWith(1, {});
      expect(result).toBe(mockResult);
    });
  });

  describe('getLikedPosts', () => {
    it('should call getLikedPosts with current user ID', async () => {
      const mockResult = { items: [], meta: {} as any };
      postInteractionService.getLikedPosts.mockResolvedValueOnce(mockResult);

      const result = await controller.getLikedPosts({ id: 1 } as any, {} as any);
      expect(postInteractionService.getLikedPosts).toHaveBeenCalledWith(1, {});
      expect(result).toBe(mockResult);
    });
  });

  describe('bookmarkPost', () => {
    it('should call bookmarkPost with user ID and post ID', async () => {
      const mockResult = { postId: 10, userId: 1 };
      postInteractionService.bookmarkPost.mockResolvedValueOnce(mockResult);

      const result = await controller.bookmarkPost({ id: 1 } as any, 10);
      expect(postInteractionService.bookmarkPost).toHaveBeenCalledWith(1, 10);
      expect(result).toBe(mockResult);
    });
  });

  describe('unbookmarkPost', () => {
    it('should call unbookmarkPost with user ID and post ID', async () => {
      const mockResult = { message: 'Đã bỏ lưu bài viết thành công' };
      postInteractionService.unbookmarkPost.mockResolvedValueOnce(mockResult);

      const result = await controller.unbookmarkPost({ id: 1 } as any, 10);
      expect(postInteractionService.unbookmarkPost).toHaveBeenCalledWith(1, 10);
      expect(result).toBe(mockResult);
    });
  });

  describe('likePost', () => {
    it('should call likePost with user ID and post ID', async () => {
      const mockResult = { postId: 10, userId: 1 };
      postInteractionService.likePost.mockResolvedValueOnce(mockResult);

      const result = await controller.likePost({ id: 1 } as any, 10);
      expect(postInteractionService.likePost).toHaveBeenCalledWith(1, 10);
      expect(result).toBe(mockResult);
    });
  });

  describe('unlikePost', () => {
    it('should call unlikePost with user ID and post ID', async () => {
      const mockResult = { message: 'Đã bỏ thích bài viết thành công' };
      postInteractionService.unlikePost.mockResolvedValueOnce(mockResult);

      const result = await controller.unlikePost({ id: 1 } as any, 10);
      expect(postInteractionService.unlikePost).toHaveBeenCalledWith(1, 10);
      expect(result).toBe(mockResult);
    });
  });
});
