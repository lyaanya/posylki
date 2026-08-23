import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "./authenticated-request.js";
import type { AuthUser } from "./users.repository.js";

/**
 * Инжектирует пользователя, которого уже проверил AuthGuard. На маршруте
 * с @Public() без токена будет undefined — обрабатывать как гостя.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authUser;
  },
);
