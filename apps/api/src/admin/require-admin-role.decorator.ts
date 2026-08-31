import { SetMetadata } from "@nestjs/common";
import type { AdminRole } from "./admin-user.repository.js";

export const REQUIRE_ADMIN_ROLE_KEY = "requireAdminRole";

/**
 * ТЗ п.16.2 — moderator видит всё, кроме управления сотрудниками и
 * справочниками; только admin может туда попасть. Ставится поверх
 * AdminGuard (см. AdminRoleGuard) — тот уже определил request.adminUser.
 */
export const RequireAdminRole = (role: AdminRole) => SetMetadata(REQUIRE_ADMIN_ROLE_KEY, role);
