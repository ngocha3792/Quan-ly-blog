import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { UserRole } from '@prisma/client';

import { ROLES_KEY, RoleHierarchy } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    /**
     * Lấy role yêu cầu từ @Roles(...)
     *
     * Ví dụ:
     * @Roles(UserRole.BLOG_OWNER)
     */
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    /**
     * API không gắn @Roles()
     * → không kiểm tra role.
     */
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (!user?.role) {
      return false;
    }

    const userRole = user.role;

    const userWeight = RoleHierarchy[userRole] ?? 0;

    /**
     * Cho phép nếu role của user
     * >= ít nhất một role yêu cầu.
     *
     * Ví dụ:
     *
     * API cần BLOG_OWNER = 2
     *
     * BLOG_OWNER = 2  → PASS
     * MODERATOR  = 3  → PASS
     * ADMIN      = 4  → PASS
     * NORMAL     = 1  → FAIL
     */
    return requiredRoles.some((requiredRole) => {
      const requiredWeight = RoleHierarchy[requiredRole] ?? 0;

      return userWeight >= requiredWeight;
    });
  }
}
