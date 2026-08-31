import { HttpStatus, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { AppException } from "../common/app-exception.js";
import type { AdminRequest } from "./admin-request.js";
import { ADMIN_SESSIONS_REPOSITORY, type IAdminSessionsRepository } from "./admin-sessions.repository.js";
import { ADMIN_USER_REPOSITORY, type IAdminUserRepository } from "./admin-user.repository.js";

const SESSION_IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

function accessDenied(message = "Доступ только для сотрудников сервиса"): AppException {
  return new AppException({ code: "FORBIDDEN", message, status: HttpStatus.FORBIDDEN });
}

/**
 * Ограничивает маршрут сотрудниками сервиса, прошедшими двухфакторную
 * аутентификацию (E16 пп.16.2-16.3, 16.5). Ставится поверх глобального
 * AuthGuard — тот уже проверил токен и отдал обычного пользователя; этот
 * guard дополнительно требует:
 * 1. активную запись admin_users с тем же id;
 * 2. запись admin_sessions для текущей Supabase-сессии (создаётся только
 *    после успешной проверки TOTP-кода — см. admin-auth.controller.ts) не
 *    старше 12 часов бездействия (16.5) — каждый запрос продлевает её.
 *
 * Маршруты входа сами по себе (POST /admin/auth/totp/setup, /verify)
 * используют более слабый AdminIdentityGuard: до второго фактора
 * admin_sessions ещё не существует, поэтому этот guard их бы отклонил.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly adminUsers: IAdminUserRepository,
    @Inject(ADMIN_SESSIONS_REPOSITORY) private readonly adminSessions: IAdminSessionsRepository,
  ) {}

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
      throw accessDenied();
    }

    if (!request.authSessionId) {
      throw accessDenied("Нужно пройти двухфакторную аутентификацию");
    }

    const session = await this.adminSessions.findBySupabaseSessionId(request.authSessionId);
    if (!session) {
      throw accessDenied("Нужно пройти двухфакторную аутентификацию");
    }

    if (Date.now() - session.lastActiveAt.getTime() > SESSION_IDLE_TIMEOUT_MS) {
      await this.adminSessions.revoke(request.authSessionId);
      throw new AppException({
        code: "ADMIN_SESSION_EXPIRED",
        message: "Сессия истекла — войдите заново",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    await this.adminSessions.touch(session.id);
    request.adminUser = admin;
    return true;
  }
}
