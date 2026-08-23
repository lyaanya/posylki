import { HttpStatus, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { AppException } from "../common/app-exception.js";
import type { AdminRequest } from "./admin-request.js";
import { ADMIN_USER_REPOSITORY, type IAdminUserRepository } from "./admin-user.repository.js";

/**
 * Ограничивает маршрут сотрудниками сервиса (E01: admin_users). Ставится
 * поверх глобального AuthGuard — тот уже проверил токен и отдал обычного
 * пользователя; этот guard дополнительно требует активную запись admin_users
 * с тем же id. Employee is-blocked/deleted не проверяется отдельно: активная
 * запись admin_users уже подразумевает рабочий доступ.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly adminUsers: IAdminUserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();

    if (!request.authUser) {
      // Не должно происходить, если AuthGuard выполняется первым (глобальный
      // guard всегда идёт раньше guard'ов контроллера) — на всякий случай.
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
