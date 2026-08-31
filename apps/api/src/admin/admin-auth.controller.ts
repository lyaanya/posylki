import { Body, Controller, Get, HttpStatus, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request.js";
import { AppException } from "../common/app-exception.js";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";
import { AdminIdentityGuard } from "./admin-identity.guard.js";
import { ADMIN_SESSIONS_REPOSITORY, type IAdminSessionsRepository } from "./admin-sessions.repository.js";
import { ADMIN_USER_REPOSITORY, type IAdminUserRepository } from "./admin-user.repository.js";
import { CurrentAdmin } from "./current-admin.decorator.js";
import type { AdminUser } from "./admin-user.repository.js";
import { VerifyTotpDto } from "./dto/verify-totp.dto.js";
import { formatSecretForDisplay, generateTotpSecret, verifyTotpCode } from "./totp.js";

/**
 * ТЗ E16 пп.16.2-16.3, 16.5 — вход в админ-панель. Пароль сотрудник вводит
 * через тот же Supabase Auth, что и обычные пользователи (apps/admin
 * держит свой собственный экран входа — 16.1 требует отдельное
 * приложение, а не отдельный протокол аутентификации); эти два маршрута —
 * второй фактор поверх уже готового JWT, обязательный шаг, без которого
 * ни один admin-*.controller.ts не откроется (см. AdminGuard).
 */
@ApiTags("admin/auth")
@UseGuards(AdminIdentityGuard)
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly adminUsers: IAdminUserRepository,
    @Inject(ADMIN_SESSIONS_REPOSITORY) private readonly adminSessions: IAdminSessionsRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
  ) {}

  /** Сообщает, привязано ли уже приложение-аутентификатор — веб решает, показывать ли экран настройки или ввод кода. */
  @Get("totp/status")
  status(@CurrentAdmin() admin: AdminUser): { enrolled: boolean } {
    return { enrolled: admin.totpSecret !== null };
  }

  /**
   * Первый вход: секрет ещё не привязан. Возвращает секрет для ручного
   * ввода в приложение-аутентификатор — сохраняется сразу, подтверждение
   * происходит следующим вызовом /totp/verify первым кодом.
   */
  @Post("totp/setup")
  setup(@CurrentAdmin() admin: AdminUser): { secret: string } {
    if (admin.totpSecret) {
      throw new AppException({
        code: "TOTP_ALREADY_ENROLLED",
        message: "Приложение-аутентификатор уже привязано",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    const secret = generateTotpSecret();
    return { secret: formatSecretForDisplay(secret) };
  }

  /**
   * Подтверждает код. Если это первый код после /setup — тот же вызов
   * сохраняет секрет насовсем (сотрудник уже ввёл его в приложение и
   * получил рабочий код, значит привязка удалась). Дальше — обычная
   * проверка кода при каждом входе.
   */
  @Post("totp/verify")
  async verify(
    @Body() dto: VerifyTotpDto,
    @CurrentAdmin() admin: AdminUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    if (!req.authSessionId) {
      throw new AppException({
        code: "AUTH_REQUIRED",
        message: "Сессия недействительна, войдите заново",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // Здесь секрета ещё нет в БД во время самого первого /setup — он
    // передаётся клиентом обратно тем же значением, что вернул /setup,
    // чтобы одно и то же значение не пришлось хранить нигде временно.
    const pendingSecret = admin.totpSecret ?? dto.pendingSecret;
    if (!pendingSecret) {
      throw new AppException({
        code: "TOTP_NOT_SET_UP",
        message: "Сначала привяжите приложение-аутентификатор",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (!verifyTotpCode(pendingSecret, dto.code)) {
      throw new AppException({
        code: "INVALID_TOTP_CODE",
        message: "Неверный код",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (!admin.totpSecret) {
      await this.adminUsers.setTotpSecret(admin.id, pendingSecret);
    }

    await this.adminSessions.create(admin.id, req.authSessionId);
    await this.auditLog.create({
      actorId: admin.id,
      action: "admin.login",
      entityType: "admin_user",
      entityId: admin.id,
    });

    return { ok: true };
  }
}
