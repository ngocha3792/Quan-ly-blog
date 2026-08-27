import {
  ExecutionContext,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  UserRole,
} from '@prisma/client';

import {
  RolesGuard,
} from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const reflector = {
    getAllAndOverride:
      jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    guard = new RolesGuard(
      reflector as unknown as Reflector,
    );
  });

  function createContext(
    role?: UserRole,
  ): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),

      switchToHttp: jest
        .fn()
        .mockReturnValue({
          getRequest: () => ({
            user: role
              ? { role }
              : undefined,
          }),
        }),
    } as unknown as ExecutionContext;
  }

  it(
    'should allow API without @Roles',
    () => {
      reflector
        .getAllAndOverride
        .mockReturnValue(undefined);

      expect(
        guard.canActivate(
          createContext(),
        ),
      ).toBe(true);
    },
  );

  it(
    'should allow moderator to access blog owner API',
    () => {
      reflector
        .getAllAndOverride
        .mockReturnValue([
          UserRole.BLOG_OWNER,
        ]);

      expect(
        guard.canActivate(
          createContext(
            UserRole.CONTENT_MODERATOR,
          ),
        ),
      ).toBe(true);
    },
  );

  it(
    'should allow admin to access moderator API',
    () => {
      reflector
        .getAllAndOverride
        .mockReturnValue([
          UserRole.CONTENT_MODERATOR,
        ]);

      expect(
        guard.canActivate(
          createContext(
            UserRole.SUPER_ADMIN,
          ),
        ),
      ).toBe(true);
    },
  );

  it(
    'should reject blog owner from moderator API',
    () => {
      reflector
        .getAllAndOverride
        .mockReturnValue([
          UserRole.CONTENT_MODERATOR,
        ]);

      expect(
        guard.canActivate(
          createContext(
            UserRole.BLOG_OWNER,
          ),
        ),
      ).toBe(false);
    },
  );

  it(
    'should reject moderator from admin API',
    () => {
      reflector
        .getAllAndOverride
        .mockReturnValue([
          UserRole.SUPER_ADMIN,
        ]);

      expect(
        guard.canActivate(
          createContext(
            UserRole.CONTENT_MODERATOR,
          ),
        ),
      ).toBe(false);
    },
  );

  it(
    'should reject request without user',
    () => {
      reflector
        .getAllAndOverride
        .mockReturnValue([
          UserRole.NORMAL,
        ]);

      expect(
        guard.canActivate(
          createContext(),
        ),
      ).toBe(false);
    },
  );
});