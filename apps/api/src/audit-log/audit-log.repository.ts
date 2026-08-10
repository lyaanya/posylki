import type { Executor } from "../database/database.js";
import type { AuditLogEntry, NewAuditLogEntry } from "./audit-log.types.js";

/**
 * Референсная форма для всех будущих репозиториев (E01 п. 1.15): интерфейс
 * не знает про Kysely/Supabase, executor необязателен — по умолчанию метод
 * использует своё подключение, но тот же вызов можно передать внутрь чужой
 * транзакции (см. runInTransaction), чтобы объединить несколько репозиториев
 * в одну атомарную операцию.
 */
export interface IAuditLogRepository {
  create(entry: NewAuditLogEntry, executor?: Executor): Promise<AuditLogEntry>;
  findByEntity(entityType: string, entityId: string, executor?: Executor): Promise<AuditLogEntry[]>;
}

export const AUDIT_LOG_REPOSITORY = Symbol("AUDIT_LOG_REPOSITORY");
