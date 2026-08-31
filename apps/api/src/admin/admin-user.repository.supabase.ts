import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { AdminUser, IAdminUserRepository } from "./admin-user.repository.js";

@Injectable()
export class SupabaseAdminUserRepository implements IAdminUserRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findById(id: string, executor: Executor = this.db): Promise<AdminUser | null> {
    const row = await executor
      .selectFrom("admin_users")
      .select(["id", "email", "full_name", "role", "is_active", "totp_secret"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      totpSecret: row.totp_secret,
    };
  }

  async findAllActive(executor: Executor = this.db): Promise<AdminUser[]> {
    const rows = await executor
      .selectFrom("admin_users")
      .select(["id", "email", "full_name", "role", "is_active", "totp_secret"])
      .where("is_active", "=", true)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      totpSecret: row.totp_secret,
    }));
  }

  async setTotpSecret(id: string, secret: string, executor: Executor = this.db): Promise<void> {
    await executor.updateTable("admin_users").set({ totp_secret: secret }).where("id", "=", id).execute();
  }
}
