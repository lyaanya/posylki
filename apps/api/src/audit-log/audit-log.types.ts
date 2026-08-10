import type { ColumnType, Generated } from "kysely";

/**
 * Таблица в терминах Kysely (snake_case, как в базе). Generated — колонки,
 * которые заполняет сама база и не нужно передавать при вставке.
 */
export interface AuditLogTable {
  id: Generated<string>;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: ColumnType<unknown | null, string | null, never>;
  after: ColumnType<unknown | null, string | null, never>;
  reason: string | null;
  created_at: ColumnType<Date, never, never>;
}

/** Запись журнала в терминах приложения (camelCase). */
export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown | null;
  after: unknown | null;
  reason: string | null;
  createdAt: Date;
}

export interface NewAuditLogEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown | null;
  after?: unknown | null;
  reason?: string | null;
}
