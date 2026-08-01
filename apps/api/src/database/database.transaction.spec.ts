import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, runInTransaction, type DB } from "./database.js";
import { Kysely } from "kysely";

/**
 * Проверяет саму транзакционную механику слоя репозиториев (E01 п. 1.16)
 * на двух временных таблицах, созданных и удалённых только для этого теста —
 * они не часть продуктовой схемы и не имеют отношения к бизнес-сущностям.
 *
 * Требует SUPABASE_DB_URL в .env — тест ходит в реальный Postgres проекта.
 */
describe("runInTransaction", () => {
  let db: Kysely<DB>;
  const parentsTable = "test_txn_parents";
  const childrenTable = "test_txn_children";

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);

    await sql`
      create table if not exists ${sql.raw(parentsTable)} (
        id uuid primary key default gen_random_uuid(),
        name text not null
      )
    `.execute(db);

    await sql`
      create table if not exists ${sql.raw(childrenTable)} (
        id uuid primary key default gen_random_uuid(),
        parent_id uuid not null references ${sql.raw(parentsTable)}(id),
        name text not null
      )
    `.execute(db);
  });

  afterAll(async () => {
    await sql`drop table if exists ${sql.raw(childrenTable)}`.execute(db);
    await sql`drop table if exists ${sql.raw(parentsTable)}`.execute(db);
    await db.destroy();
  });

  it("откатывает обе операции целиком, если вторая завершилась ошибкой", async () => {
    const parentId = randomUUID();
    const marker = `rollback-${parentId}`;

    await expect(
      runInTransaction(db, async (trx) => {
        await sql`
          insert into ${sql.raw(parentsTable)} (id, name) values (${parentId}, ${marker})
        `.execute(trx);

        // Намеренная ошибка после первой успешной записи —
        // проверяем, что она не остаётся в базе после отката.
        throw new Error("Намеренный сбой для проверки отката транзакции");
      }),
    ).rejects.toThrow("Намеренный сбой");

    const parentRow = await sql`
      select id from ${sql.raw(parentsTable)} where id = ${parentId}
    `.execute(db);

    expect(parentRow.rows).toHaveLength(0);
  });

  it("фиксирует обе операции, когда обе завершились успешно", async () => {
    const parentId = randomUUID();
    const childId = randomUUID();
    const marker = `commit-${parentId}`;

    await runInTransaction(db, async (trx) => {
      await sql`
        insert into ${sql.raw(parentsTable)} (id, name) values (${parentId}, ${marker})
      `.execute(trx);

      await sql`
        insert into ${sql.raw(childrenTable)} (id, parent_id, name)
        values (${childId}, ${parentId}, ${marker})
      `.execute(trx);
    });

    const parentRow = await sql`
      select id from ${sql.raw(parentsTable)} where id = ${parentId}
    `.execute(db);
    const childRow = await sql`
      select id from ${sql.raw(childrenTable)} where id = ${childId}
    `.execute(db);

    expect(parentRow.rows).toHaveLength(1);
    expect(childRow.rows).toHaveLength(1);
  });
});
