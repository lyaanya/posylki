import { HttpStatus, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { AppException } from "../common/app-exception.js";
import type { AdminRequest } from "./admin-request.js";
import { ADMIN_USER_REPOSITORY, type IAdminUserRepository } from "./admin-user.repository.js";

/**
 * Проверяет только "это активный сотрудник" (admin_users), без второго
 * фактора — используется исключительно для маршрутов первого шага входа
 * (POST /admin/auth/totp/setup, /verify, см. admin-auth.controller.ts),
 * которым ещё нечем подтвердить 2FA. Все остальные admin-*.controller.ts
 * используют AdminGuard, который дополнительно требует admin_sessions.
 */
@Injectable()
export class AdminIdentityGuard implements CanActivate {
  constructor(@Inject(ADMIN_USER_REPOSITORY) private readonly adminUsers: IAdminUserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();

    if (!request.authUser) {
      throw new AppException({
        code: "AUTH_REQUIRED",
        message: "Нужно войти в аккаунт",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const admin = await this.adminUsers.findById(request.authUser.id);
    if (!admin || !admin.isActive) {
      throw new AppException({
        code: "FORBIDDEN",
        message: "Доступ только для сотрудников сервиса",
        status: HttpStatus.FORBIDDEN,
      });
    }

    request.adminUser = admin;
    return true;
  }
}
