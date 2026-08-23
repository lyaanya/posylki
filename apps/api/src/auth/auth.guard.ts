import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "../common/app-exception.js";
import type { AuthenticatedRequest } from "./authenticated-request.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { SupabaseJwtService } from "./supabase-jwt.service.js";
import { USERS_REPOSITORY, type IUsersRepository } from "./users.repository.js";

function authRequired(message: string): AppException {
  return new AppException({ code: "AUTH_REQUIRED", message, status: HttpStatus.UNAUTHORIZED });
}

/**
 * Глобальный guard уровня доступа (E03 п. 3.10–3.12): по умолчанию требует
 * валидный токен Supabase Auth и живого, незаблокированного пользователя;
 * маршрут с @Public() пропускает гостя без токена вовсе.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SupabaseJwtService) private readonly jwtService: SupabaseJwtService,
    @Inject(USERS_REPOSITORY) private readonly usersRepository: IUsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      if (isPublic) {
        return true;
      }
      throw authRequired("Нужно войти в аккаунт");
    }

    let claims;
    try {
      claims = await this.jwtService.verify(token);
    } catch {
      throw authRequired("Сессия недействительна, войдите заново");
    }

    const user = await this.usersRepository.findById(claims.userId);

    if (!user || user.deletedAt || user.isBlocked) {
      throw authRequired("Сессия недействительна, войдите заново");
    }

    request.authUser = user;
    request.authSessionId = claims.sessionId;
    return true;
  }
}
