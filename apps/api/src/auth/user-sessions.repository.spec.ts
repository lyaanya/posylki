import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseUserSessionsRepository } from "./user-sessions.repository.supabase.js";

describe("SupabaseUserSessionsRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseUserSessionsRepository;
  let userId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseUserSessionsRepository(db);

    // Тестовый пользователь через auth.users — тот же путь, что и в реальной
    // регистрации: profile в public.users создаётся триггером автоматически.
    userId = randomUUID();
    await sql`insert into auth.users (id, email) values (${userId}, ${`test-sessions-${userId}@example.com`})`.execute(
      db,
    );
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await sql`delete from user_sessions where id = any(${createdIds})`.execute(db);
    }
    await sql`delete from auth.users where id = ${userId}`.execute(db);
    await db.destroy();
  });

  it("создаёт сессию, находит её среди активных, продлевает и отзывает", async () => {
    const created = await repository.create({
      userId,
      supabaseSessionId: randomUUID(),
      userAgent: "vitest",
      ipAddress: "127.0.0.1",
    });
    createdIds.push(created.id);

    expect(created.revokedAt).toBeNull();

    const active = await repository.findActiveByUser(userId);
    expect(active.map((s) => s.id)).toContain(created.id);

    await repository.touch(created.id);
    const touched = await repository.findById(created.id);
    expect(touched?.lastSeenAt.getTime()).toBeGreaterThanOrEqual(created.lastSeenAt.getTime());

    await repository.revoke(created.id);
    const afterRevoke = await repository.findActiveByUser(userId);
    expect(afterRevoke.map((s) => s.id)).not.toContain(created.id);
  });
});
