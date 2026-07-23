//Mục đích: Guard này chạy sau JwtAuthGuard. Lúc này ta đã biết user là ai (nhờ request.user), ta sẽ đối chiếu chức danh
//  (Role) của user đó với yêu cầu của Decorator @Roles('admin', 'editor') để xem họ có quyền thực hiện thao tác hay không.
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, RoleHierarchy } from '../decorators';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Nếu API không gắn @Roles() -> pass
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.role) return false;

        const userRoleWeight = RoleHierarchy[user.role as UserRole] || 0;

        // Cho phép nếu User có Role lớn hơn hoặc bằng MỘT TRONG CÁC Role yêu cầu
        return requiredRoles.some((role) => {
            const requiredWeight = RoleHierarchy[role] || 0;
            return userRoleWeight >= requiredWeight;
        });
    }
}
