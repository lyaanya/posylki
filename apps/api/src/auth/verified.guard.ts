import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { AppException } from "../common/app-exception.js";
import type { AuthenticatedRequest } from "./authenticated-request.js";

/**
 * Уровень «Верифицирован» (E03 п. 3.10): публикация объявлений и вход
 * в сделку. Ставится вместе с AuthGuard (@UseGuards(AuthGuard, VerifiedGuard))
 * на конкретных эндпоинтах в E07/E10 — не глобально, большинству маршрутов
 * достаточно уровня «Зарегистрирован».
 */
@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.authUser?.verificationStatus !== "approved") {
      throw new AppException({
        code: "VERIFICATION_REQUIRED",
        message: "Это действие доступно только после верификации по документу",
        status: HttpStatus.FORBIDDEN,
      });
    }

    return true;
  }
}
