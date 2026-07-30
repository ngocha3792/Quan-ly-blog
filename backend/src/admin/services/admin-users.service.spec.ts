import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import {
  PrismaService,
  UsersService,
  UserNotFoundException,
  EmailAlreadyExistsException,
  UsernameAlreadyExistsException,
  BcryptUtil,
  UserEntity,
} from '@app/core';
import { AdminUsersService } from './admin-users.service';
import { AdminUserEntity } from '../entities';

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    userSession: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockUsersService = {
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  const mockBcryptUtil = {
    hashPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockPrismaService.$transaction.mockImplementation(
      async (operations: Promise<unknown>[]) => Promise.all(operations),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: BcryptUtil,
          useValue: mockBcryptUtil,
        },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to usersService.findAll and wrap items in AdminUserEntity', async () => {
      const mockResult = {
        items: [
          new UserEntity({
            id: 1,
            username: 'user1',
            email: 'user1@example.com',
            role: UserRole.NORMAL,
            status: UserStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ],
        meta: {
          totalItems: 1,
          itemCount: 1,
          itemsPerPage: 10,
          totalPages: 1,
          currentPage: 1,
        },
      };

      mockUsersService.findAll.mockResolvedValueOnce(mockResult);

      const result = await service.findAll({} as any, { skip: 0, take: 10, page: 1 });

      expect(mockUsersService.findAll).toHaveBeenCalledWith({}, { skip: 0, take: 10, page: 1 });
      expect(result.items[0]).toBeInstanceOf(AdminUserEntity);
      expect(result.items[0].username).toBe('user1');
    });
  });

  describe('findOne', () => {
    it('should return AdminUserEntity with posts when user is found', async () => {
      const mockUser = {
        id: 1,
        username: 'blogowner1',
        email: 'bo@example.com',
        role: UserRole.BLOG_OWNER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        posts: [
          {
            id: 10,
            title: 'Test Post',
            content: 'Content',
            status: 'PUBLISH',
            viewCount: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: {
              postLikes: 15,
              comments: 5,
            },
            postCategories: [],
            postTags: [],
          },
        ],
      };

      mockPrismaService.user.findFirst.mockResolvedValueOnce(mockUser);

      const result = await service.findOne(1);

      expect(result).toBeInstanceOf(AdminUserEntity);
      expect(result.id).toBe(1);
      expect(result.posts).toHaveLength(1);
      expect(result.posts![0].viewCount).toBe(100);
      expect(result.posts![0].likeCount).toBe(15);
      expect(result.posts![0].commentCount).toBe(5);
    });

    it('should throw UserNotFoundException if user is not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(999)).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('lockUser', () => {
    it('should lock user and revoke sessions', async () => {
      const mockUser = { id: 2, username: 'test' };
      const updatedUser = {
        ...mockUser,
        status: UserStatus.LOCKED,
        lockedAt: new Date(),
        lockedById: 1,
        lockReason: 'Spam',
      };

      mockUsersService.findById.mockResolvedValueOnce(mockUser);
      mockPrismaService.user.update.mockResolvedValueOnce(updatedUser);
      mockPrismaService.userSession.updateMany.mockResolvedValueOnce({ count: 2 });

      const result = await service.lockUser(2, 1, { reason: 'Spam' });

      expect(result).toBeInstanceOf(AdminUserEntity);
      expect(result.status).toBe(UserStatus.LOCKED);
      expect(mockPrismaService.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 2, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UserNotFoundException if user to lock does not exist', async () => {
      mockUsersService.findById.mockResolvedValueOnce(null);

      await expect(service.lockUser(999, 1, { reason: 'Spam' })).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('unlockUser', () => {
    it('should unlock user and clear lock fields', async () => {
      const mockUser = { id: 2, status: UserStatus.LOCKED };
      const updatedUser = {
        ...mockUser,
        status: UserStatus.ACTIVE,
        lockedAt: null,
        lockedById: null,
        lockReason: null,
      };

      mockUsersService.findById.mockResolvedValueOnce(mockUser);
      mockPrismaService.user.update.mockResolvedValueOnce(updatedUser);

      const result = await service.unlockUser(2);

      expect(result).toBeInstanceOf(AdminUserEntity);
      expect(result.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('changeRole', () => {
    it('should update user role', async () => {
      const mockUser = { id: 2, role: UserRole.NORMAL };
      const updatedUser = { ...mockUser, role: UserRole.CONTENT_MODERATOR };

      mockUsersService.findById.mockResolvedValueOnce(mockUser);
      mockPrismaService.user.update.mockResolvedValueOnce(updatedUser);

      const result = await service.changeRole(2, { role: UserRole.CONTENT_MODERATOR });

      expect(result).toBeInstanceOf(AdminUserEntity);
      expect(result.role).toBe(UserRole.CONTENT_MODERATOR);
    });
  });

  describe('createModerator', () => {
    it('should create new moderator account', async () => {
      const dto = {
        username: 'mod1',
        email: 'mod1@example.com',
        password: 'password123',
      };

      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      mockBcryptUtil.hashPassword.mockResolvedValueOnce('hashed_pwd');
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: 3,
        username: dto.username,
        email: dto.email,
        role: UserRole.CONTENT_MODERATOR,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createModerator(dto);

      expect(result).toBeInstanceOf(AdminUserEntity);
      expect(result.role).toBe(UserRole.CONTENT_MODERATOR);
    });

    it('should throw EmailAlreadyExistsException if email exists', async () => {
      const dto = {
        username: 'mod1',
        email: 'mod1@example.com',
        password: 'password123',
      };

      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        email: 'mod1@example.com',
        username: 'different',
      });

      await expect(service.createModerator(dto)).rejects.toThrow(EmailAlreadyExistsException);
    });

    it('should throw UsernameAlreadyExistsException if username exists', async () => {
      const dto = {
        username: 'mod1',
        email: 'mod1@example.com',
        password: 'password123',
      };

      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        email: 'different@example.com',
        username: 'mod1',
      });

      await expect(service.createModerator(dto)).rejects.toThrow(UsernameAlreadyExistsException);
    });
  });
});
