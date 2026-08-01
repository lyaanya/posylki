import { Kysely, PostgresDialect, type Transaction } from "kysely";
import { Pool } from "pg";

/**
 * Схема базы, дополняется по мере появления таблиц в каждом эпике —
 * каждая новая таблица добавляется сюда как поле: `audit_log: AuditLogTable`.
 * Пустая на этапе E01: ни одной продуктовой таблицы ещё нет.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DB {}

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
