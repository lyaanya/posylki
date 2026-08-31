import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IWarningsRepository, NewUserWarning } from "./warnings.repository.js";
import type { UserWarning } from "./moderation.types.js";

interface WarningRow {
  id: string;
  user_id: string;
  reason: string;
  created_at: Date;
  acknowledged_at: Date | null;
}

function toEntity(row: WarningRow): UserWarning {
  return {
    id: row.id,
    userId: row.user_id,
    reason: row.reason,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
  };
}

@Injectable()
export class SupabaseWarningsRepository implements IWarningsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(input: NewUserWarning, executor: Executor = this.db): Promise<UserWarning> {
    const inserted = await executor
      .insertInto("user_warnings")
      .values({
        user_id: input.userId,
        issued_by: input.issuedBy,
        complaint_id: input.complaintId,
        reason: input.reason,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toEntity(inserted as WarningRow);
  }

  async findOldestUnacknowledged(userId: string, executor: Executor = this.db): Promise<UserWarning | null> {
    const row = await executor
      .selectFrom("user_warnings")
      .selectAll()
      .where("user_id", "=", userId)
      .where("acknowledged_at", "is", null)
      .orderBy("created_at", "asc")
      .executeTakeFirst();
    return row ? toEntity(row as WarningRow) : null;
  }

  async findByUser(userId: string, executor: Executor = this.db): Promise<UserWarning[]> {
    const rows = await executor
      .selectFrom("user_warnings")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((row) => toEntity(row as WarningRow));
  }

  async acknowledge(id: string, userId: string, executor: Executor = this.db): Promise<UserWarning | null> {
    await executor
      .updateTable("user_warnings")
      .set({ acknowledged_at: new Date().toISOString() })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .where("acknowledged_at", "is", null)
      .execute();
    const row = await executor
      .selectFrom("user_warnings")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toEntity(row as WarningRow) : null;
  }
}
