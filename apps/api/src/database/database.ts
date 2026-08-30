import { Kysely, PostgresDialect, type Transaction } from "kysely";
import { Pool } from "pg";
import type { AuditLogTable } from "../audit-log/audit-log.types.js";
import type {
  LegalConsentsTable,
  LegalDocumentsTable,
  UserSessionsTable,
  UsersTable,
} from "../auth/auth.types.js";
import type {
  CitiesTable,
  CurrenciesTable,
  DocumentTypesTable,
  StopListItemsTable,
  WeightReferencesTable,
} from "../directories/directories.types.js";
import type { AdminUsersTable } from "../admin/admin.types.js";
import type { AiRequestsTable } from "../ai/ai.types.js";
import type { ListingsTable } from "../listings/listings.types.js";

/**
 * Схема базы, дополняется по мере появления таблиц в каждом эпике —
 * каждая новая таблица добавляется сюда как поле: `<table>: <Table>Table`.
 */
export interface DB {
  audit_log: AuditLogTable;
  users: UsersTable;
  legal_documents: LegalDocumentsTable;
  legal_consents: LegalConsentsTable;
  user_sessions: UserSessionsTable;
  cities: CitiesTable;
  currencies: CurrenciesTable;
  weight_references: WeightReferencesTable;
  stop_list_items: StopListItemsTable;
  document_types: DocumentTypesTable;
  admin_users: AdminUsersTable;
  ai_requests: AiRequestsTable;
  listings: ListingsTable;
}

/**
 * Executor — общий тип для "обычного" подключения и для транзакции.
 * Методы репозиториев принимают Executor вместо конкретно Kysely<DB>,
 * чтобы один и тот же метод одинаково работал и вне транзакции,
 * и будучи вызванным внутри чужой транзакции (см. runInTransaction).
 */
export type Executor = Kysely<DB> | Transaction<DB>;

export function createDatabase(connectionString: string): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
  });
}

/**
 * Единая точка входа для многотабличных атомарных операций (E01 п. 1.16).
 * Внутри fn все репозитории вызываются с переданным trx, чтобы попасть
 * в одну транзакцию: либо применяется всё, либо не применяется ничего.
 */
export function runInTransaction<T>(
  db: Kysely<DB>,
  fn: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(fn);
}
