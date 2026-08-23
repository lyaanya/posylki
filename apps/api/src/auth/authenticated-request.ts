import type { Request } from "express";
import type { AuthUser } from "./users.repository.js";

export interface AuthenticatedRequest extends Request {
  /** Заполняется AuthGuard'ом; отсутствует на маршрутах с @Public(). */
  authUser?: AuthUser;
  authSessionId?: string | null;
}
