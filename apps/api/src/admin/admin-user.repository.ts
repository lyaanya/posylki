import type { Executor } from "../database/database.js";

export type AdminRole = "admin" | "moderator";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  /** ТЗ п.16.3 — null до первой привязки приложения-аутентификатора. */
  totpSecret: string | null;
}

export interface IAdminUserRepository {
  findById(id: string, executor?: Executor): Promise<AdminUser | null>;
  /** ТЗ E15 п.15.17 — все дежурные, кому шлётся уведомление о новом обращении. */
  findAllActive(executor?: Executor): Promise<AdminUser[]>;
  /** ТЗ п.16.3 — записывается один раз, при первой привязке приложения-аутентификатора. */
  setTotpSecret(id: string, secret: string, executor?: Executor): Promise<void>;
}

export const ADMIN_USER_REPOSITORY = Symbol("ADMIN_USER_REPOSITORY");
