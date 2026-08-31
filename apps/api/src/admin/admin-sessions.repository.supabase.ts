import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { AdminSession, IAdminSessionsRepository } from "./admin-sessions.repository.js";

function toDomain(row: { id: string; admin_id: string; supabase_session_id: string; last_active_at: Date }): AdminSession {
  return { id: row.id, adminId: row.admin_id, supabaseSessionId: row.supabase_session_id, lastActiveAt: row.last_active_at };
}

@Injectable()
export class SupabaseAdminSessionsRepository implements IAdminSessionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(adminId: string, supabaseSessionId: string, executor: Executor = this.db): Promise<AdminSession> {
    const row = await executor
      .insertInto("admin_sessions")
      .values({ admin_id: adminId, supabase_session_id: supabaseSessionId })
      .onConflict((oc) => oc.column("supabase_session_id").doUpdateSet({ last_active_at: sql`now()` }))
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findBySupabaseSessionId(supabaseSessionId: string, executor: Executor = this.db): Promise<AdminSession | null> {
    const row = await executor
      .selectFrom("admin_sessions")
      .selectAll()
      .where("supabase_session_id", "=", supabaseSessionId)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async touch(id: string, executor: Executor = this.db): Promise<void> {
    await executor.updateTable("admin_sessions").set({ last_active_at: sql`now()` }).where("id", "=", id).execute();
  }

  async revoke(supabaseSessionId: string, executor: Executor = this.db): Promise<void> {
    await executor.deleteFrom("admin_sessions").where("supabase_session_id", "=", supabaseSessionId).execute();
  }
}
