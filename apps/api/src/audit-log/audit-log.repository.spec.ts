import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseAuditLogRepository } from "./audit-log.repository.supabase.js";

describe("SupabaseAuditLogRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseAuditLogRepository;
  const createdIds: string[] = [];

  beforeAll(() => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseAuditLogRepository(db);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await sql`delete from audit_log where id = any(${createdIds})`.execute(db);
    }
    await db.destroy();
  });

  it("создаёт запись и читает её обратно по сущности", async () => {
    const entityId = randomUUID();
    const actorId = randomUUID();

    const created = await repository.create({
      actorId,
      action: "user.block",
      entityType: "user",
      entityId,
      before: { status: "active" },
      after: { status: "blocked" },
      reason: "тестовая запись из audit-log.repository.spec.ts",
    });
    createdIds.push(created.id);

    expect(created.id).toBeTruthy();
    expect(created.actorId).toBe(actorId);
    expect(created.action).toBe("user.block");
    expect(created.before).toEqual({ status: "active" });
    expect(created.after).toEqual({ status: "blocked" });
    expect(created.createdAt).toBeInstanceOf(Date);

    const found = await repository.findByEntity("user", entityId);

    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe(created.id);
    expect(found[0]?.reason).toBe("тестовая запись из audit-log.repository.spec.ts");
  });

  it("не находит записи по чужой сущности", async () => {
    const found = await repository.findByEntity("user", randomUUID());
    expect(found).toHaveLength(0);
  });
});
