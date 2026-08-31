import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely, type Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IUserSessionsRepository } from "./user-sessions.repository.js";
import type { NewUserSession, UserSession, UserSessionsTable } from "./auth.types.js";

function toEntity(row: Selectable<UserSessionsTable>): UserSession {
  return {
    id: row.id,
    userId: row.user_id,
    supabaseSessionId: row.supabase_session_id,
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
    createdAt: new Date(row.created_at),
    lastSeenAt: new Date(row.last_seen_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  };
}

@Injectable()
export class SupabaseUserSessionsRepository implements IUserSessionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(session: NewUserSession, executor: Executor = this.db): Promise<UserSession> {
    const row = await executor
      .insertInto("user_sessions")
      .values({
        user_id: session.userId,
        supabase_session_id: session.supabaseSessionId,
        user_agent: session.userAgent ?? null,
        ip_address: session.ipAddress ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toEntity(row);
  }

  async findActiveByUser(userId: string, executor: Executor = this.db): Promise<UserSession[]> {
    const rows = await executor
      .selectFrom("user_sessions")
      .selectAll()
      .where("user_id", "=", userId)
      .where("revoked_at", "is", null)
      .orderBy("last_seen_at", "desc")
      .execute();

    return rows.map(toEntity);
  }

  async findById(id: string, executor: Executor = this.db): Promise<UserSession | null> {
    const row = await executor
      .selectFrom("user_sessions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async touch(id: string, executor: Executor = this.db): Promise<void> {
    // now() на стороне БД, а не new Date() в приложении — та же временная
    // шкала, что и у DEFAULT now() при создании строки (create() выше),
    // иначе рассинхрон часов клиента и сервера БД мог сделать "более новую"
    // отметку меньше исходной.
    await executor
      .updateTable("user_sessions")
      .set({ last_seen_at: sql`now()` })
      .where("id", "=", id)
      .execute();
  }

  async revoke(id: string, executor: Executor = this.db): Promise<void> {
    await executor
      .updateTable("user_sessions")
      .set({ revoked_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
  }
}
