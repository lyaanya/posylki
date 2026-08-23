import type { ColumnType } from "kysely";
import type { AdminRole } from "./admin-user.repository.js";

/** admin_users (E01) — сотрудники сервиса, отдельная запись поверх auth.users. */
export interface AdminUsersTable {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
}
