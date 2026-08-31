import type { ColumnType, Generated } from "kysely";
import type { AdminRole } from "./admin-user.repository.js";

/** admin_users (E01) — сотрудники сервиса, отдельная запись поверх auth.users. */
export interface AdminUsersTable {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
  /** ТЗ п.16.3 — заводится один раз при первом входе, см. admin-auth.controller.ts. */
  totp_secret: string | null;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

/** admin_sessions (E16 п.16.5) — привязана к supabase session_id, флаг "этот вход прошёл 2FA". */
export interface AdminSessionsTable {
  id: Generated<string>;
  admin_id: string;
  supabase_session_id: string;
  created_at: ColumnType<Date, never, never>;
  last_active_at: ColumnType<Date, string | undefined, string>;
}
