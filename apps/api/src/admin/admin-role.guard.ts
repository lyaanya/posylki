import { HttpStatus, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppException } from "../common/app-exception.js";
import type { AdminRequest } from "./admin-request.js";
import { REQUIRE_ADMIN_ROLE_KEY } from "./require-admin-role.decorator.js";
import type { AdminRole } from "./admin-user.repository.js";

/**
 * Ставится ПОСЛЕ AdminGuard в @UseGuards (порядок важен — читает
 * request.adminUser, который заполняет AdminGuard). Маршруты без
 * @RequireAdminRole пропускают любую активную роль.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.getAllAndOverride<AdminRole>(REQUIRE_ADMIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRole) return true;

    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (request.adminUser?.role !== requiredRole) {
      throw new AppException({
        code: "FORBIDDEN",
        message: "Недостаточно прав для этого действия",
        status: HttpStatus.FORBIDDEN,
      });
    }
    return true;
  }
}
