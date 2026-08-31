import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IBansRepository, NewUserBan } from "./bans.repository.js";
import type { UserBan } from "./moderation.types.js";

interface BanRow {
  id: string;
  user_id: string;
  reason: string;
  banned_until: Date | null;
  is_active: boolean;
  created_at: Date;
}

function toEntity(row: BanRow): UserBan {
  return {
    id: row.id,
    userId: row.user_id,
    reason: row.reason,
    bannedUntil: row.banned_until,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

@Injectable()
export class SupabaseBansRepository implements IBansRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(input: NewUserBan, executor: Executor = this.db): Promise<UserBan> {
    const inserted = await executor
      .insertInto("user_bans")
      .values({
        user_id: input.userId,
        banned_by: input.bannedBy,
        complaint_id: input.complaintId,
        reason: input.reason,
        banned_until: input.bannedUntil ? input.bannedUntil.toISOString() : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toEntity(inserted as BanRow);
  }

  async findActiveForUser(userId: string, executor: Executor = this.db): Promise<UserBan | null> {
    const row = await executor
      .selectFrom("user_bans")
      .selectAll()
      .where("user_id", "=", userId)
      .where("is_active", "=", true)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    return row ? toEntity(row as BanRow) : null;
  }

  async findByUser(userId: string, executor: Executor = this.db): Promise<UserBan[]> {
    const rows = await executor
      .selectFrom("user_bans")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((row) => toEntity(row as BanRow));
  }

  async unban(
    id: string,
    unbannedBy: string | null,
    reason: string,
    executor: Executor = this.db,
  ): Promise<UserBan | null> {
    await executor
      .updateTable("user_bans")
      .set({
        is_active: false,
        unbanned_at: new Date().toISOString(),
        unbanned_by: unbannedBy,
        unban_reason: reason,
      })
      .where("id", "=", id)
      .where("is_active", "=", true)
      .execute();
    const row = await executor.selectFrom("user_bans").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? toEntity(row as BanRow) : null;
  }

  async findExpiredActive(asOf: Date, executor: Executor = this.db): Promise<UserBan[]> {
    const rows = await executor
      .selectFrom("user_bans")
      .selectAll()
      .where("is_active", "=", true)
      .where("banned_until", "is not", null)
      .where("banned_until", "<=", asOf)
      .execute();
    return rows.map((row) => toEntity(row as BanRow));
  }
}
