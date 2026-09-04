import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard, AuthsService } from '@app/core';
import { UserAuthController } from './user-auth.controller';

describe('UserAuthController', () => {
  let controller: UserAuthController;
  let authsService: {
    refreshToken: jest.Mock;
    logout: jest.Mock;
    logoutAll: jest.Mock;
  };

  beforeEach(async () => {
    authsService = {
      refreshToken: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAuthController],
      providers: [
        {
          provide: AuthsService,
          useValue: authsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<UserAuthController>(UserAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('refreshToken', () => {
    it('should call authsService.refreshToken', async () => {
      authsService.refreshToken.mockResolvedValueOnce({ accessToken: 'token' });
      const dto = { refreshToken: 'ref' };
      const res = await controller.refreshToken(dto, '127.0.0.1', 'agent');
      expect(authsService.refreshToken).toHaveBeenCalledWith(
        dto,
        '127.0.0.1',
        'agent',
      );
      expect(res).toEqual({ accessToken: 'token' });
    });
  });

  describe('logout', () => {
    it('should call authsService.logout', async () => {
      authsService.logout.mockResolvedValueOnce({ success: true });
      const dto = { refreshToken: 'ref' };
      const res = await controller.logout(dto);
      expect(authsService.logout).toHaveBeenCalledWith(dto);
      expect(res).toEqual({ success: true });
    });
  });

  describe('logoutAll', () => {
    it('should call authsService.logoutAll with user id from JWT payload', async () => {
      authsService.logoutAll.mockResolvedValueOnce({ count: 3 });
      const mockUser = { id: 15, email: 'user@example.com' };
      const res = await controller.logoutAll(mockUser as any);
      expect(authsService.logoutAll).toHaveBeenCalledWith(15);
      expect(res).toEqual({ count: 3 });
    });
  });
});
