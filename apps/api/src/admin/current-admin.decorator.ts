import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AdminRequest } from "./admin-request.js";
import type { AdminUser } from "./admin-user.repository.js";

/** Инжектирует сотрудника, которого уже проверил AdminGuard. */
export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminUser => {
  const request = ctx.switchToHttp().getRequest<AdminRequest>();
  // AdminGuard уже гарантировал наличие adminUser к этому моменту.
  return request.adminUser as AdminUser;
});
