import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { AuthUser, IUsersRepository } from "./users.repository.js";

@Injectable()
export class SupabaseUsersRepository implements IUsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findById(id: string, executor: Executor = this.db): Promise<AuthUser | null> {
    const row = await executor
      .selectFrom("users")
      .select(["id", "email", "verification_status", "is_blocked", "deleted_at"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      verificationStatus: row.verification_status,
      isBlocked: row.is_blocked,
      deletedAt: row.deleted_at,
    };
  }
}
