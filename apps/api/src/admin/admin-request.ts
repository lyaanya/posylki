import type { AuthenticatedRequest } from "../auth/authenticated-request.js";
import type { AdminUser } from "./admin-user.repository.js";

export interface AdminRequest extends AuthenticatedRequest {
  /** Заполняется AdminGuard'ом поверх уже проверенного AuthGuard'ом authUser. */
  adminUser?: AdminUser;
}
