import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IAuditLogRepository } from "./audit-log.repository.js";
import type { AuditLogEntry, NewAuditLogEntry } from "./audit-log.types.js";

interface AuditLogRow {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown | null;
  after: unknown | null;
  reason: string | null;
  created_at: Date;
}

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row.before,
    after: row.after,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function toJsonbParam(value: unknown | null | undefined): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

@Injectable()
export class SupabaseAuditLogRepository implements IAuditLogRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(entry: NewAuditLogEntry, executor: Executor = this.db): Promise<AuditLogEntry> {
    const row = await executor
      .insertInto("audit_log")
      .values({
        actor_id: entry.actorId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        before: toJsonbParam(entry.before),
        after: toJsonbParam(entry.after),
        reason: entry.reason ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toEntry(row);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    executor: Executor = this.db,
  ): Promise<AuditLogEntry[]> {
    const rows = await executor
      .selectFrom("audit_log")
      .selectAll()
      .where("entity_type", "=", entityType)
      .where("entity_id", "=", entityId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toEntry);
  }
}
