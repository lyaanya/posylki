import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseUsersRepository } from "./users.repository.supabase.js";

describe("SupabaseUsersRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseUsersRepository;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseUsersRepository(db);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await sql`delete from auth.users where id = any(${createdUserIds})`.execute(db);
    }
    await db.destroy();
  });

  it("emailConfirmed=false для только что зарегистрированного пользователя", async () => {
    const id = randomUUID();
    await sql`insert into auth.users (id, email) values (${id}, ${`test-users-repo-${id}@example.com`})`.execute(
      db,
    );
    createdUserIds.push(id);

    const user = await repository.findById(id);
    expect(user?.emailConfirmed).toBe(false);
  });

  it("emailConfirmed=true после подтверждения почты (email_confirmed_at заполнен)", async () => {
    const id = randomUUID();
    await sql`insert into auth.users (id, email, email_confirmed_at) values (${id}, ${`test-users-repo-confirmed-${id}@example.com`}, now())`.execute(
      db,
    );
    createdUserIds.push(id);

    const user = await repository.findById(id);
    expect(user?.emailConfirmed).toBe(true);
  });

  it("возвращает null для несуществующего пользователя", async () => {
    const user = await repository.findById(randomUUID());
    expect(user).toBeNull();
  });
});
