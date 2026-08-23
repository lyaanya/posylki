import type { Executor } from "../database/database.js";

export type AdminRole = "admin" | "moderator";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
}

export interface IAdminUserRepository {
  findById(id: string, executor?: Executor): Promise<AdminUser | null>;
}

export const ADMIN_USER_REPOSITORY = Symbol("ADMIN_USER_REPOSITORY");
