import type { Executor } from "../database/database.js";

export interface AdminSession {
  id: string;
  adminId: string;
  supabaseSessionId: string;
  lastActiveAt: Date;
}

export interface IAdminSessionsRepository {
  /** ТЗ п.16.3 — создаётся сразу после успешной проверки кода из приложения-аутентификатора. */
  create(adminId: string, supabaseSessionId: string, executor?: Executor): Promise<AdminSession>;
  findBySupabaseSessionId(supabaseSessionId: string, executor?: Executor): Promise<AdminSession | null>;
  /** ТЗ п.16.5 — продлевает бездействие при каждом запросе. */
  touch(id: string, executor?: Executor): Promise<void>;
  revoke(supabaseSessionId: string, executor?: Executor): Promise<void>;
}

export const ADMIN_SESSIONS_REPOSITORY = Symbol("ADMIN_SESSIONS_REPOSITORY");
