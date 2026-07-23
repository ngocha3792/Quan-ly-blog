// Mục đích: Gắn nhãn yêu cầu chức danh (Role) cho API.

import { SetMetadata } from '@nestjs/common';

import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const RoleHierarchy: Record<UserRole, number> = {
    [UserRole.NORMAL]: 1,
    [UserRole.BLOG_OWNER]: 2,
    [UserRole.CONTENT_MODERATOR]: 3,
    [UserRole.SUPER_ADMIN]: 4,
};

// Nhận vào một mảng các roles (ví dụ: UserRole.NORMAL, UserRole.SUPER_ADMIN, ...)
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
