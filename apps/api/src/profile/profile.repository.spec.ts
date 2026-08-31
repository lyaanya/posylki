import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseProfileRepository } from "./profile.repository.supabase.js";

describe("SupabaseProfileRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseProfileRepository;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseProfileRepository(db);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await sql`delete from auth.users where id = any(${createdUserIds})`.execute(db);
    }
    await db.destroy();
  });

  async function createTestUser(email: string): Promise<string> {
    const id = randomUUID();
    await sql`insert into auth.users (id, email) values (${id}, ${email})`.execute(db);
    createdUserIds.push(id);
    return id;
  }

  it("отдаёт активный профиль без имени и с пустыми показателями сразу после регистрации", async () => {
    const id = await createTestUser(`profile-active-${randomUUID()}@example.com`);

    const view = await repository.findPublicProfile(id);

    expect(view?.status).toBe("active");
    if (view?.status !== "active") throw new Error("ожидался активный профиль");
    expect(view.displayName).toBeNull();
    expect(view.courierRating).toBeNull();
    expect(view.courierDealsCount).toBe(0);
    expect(view.frequentRoutes).toEqual([]);
  });

  it("возвращает null для несуществующего профиля", async () => {
    const view = await repository.findPublicProfile(randomUUID());
    expect(view).toBeNull();
  });

  it("публичный профиль заблокированного пользователя отдаёт только статус blocked", async () => {
    const id = await createTestUser(`profile-blocked-${randomUUID()}@example.com`);
    await sql`update users set is_blocked = true where id = ${id}`.execute(db);

    const view = await repository.findPublicProfile(id);
    expect(view).toEqual({ status: "blocked", id });
  });

  it("публичный профиль удалённого пользователя отдаёт только статус deleted, даже если он ещё и заблокирован", async () => {
    const id = await createTestUser(`profile-deleted-${randomUUID()}@example.com`);
    await sql`update users set is_blocked = true, deleted_at = now() where id = ${id}`.execute(db);

    const view = await repository.findPublicProfile(id);
    expect(view).toEqual({ status: "deleted", id });
  });

  it("свой профиль содержит email и телефон, которых нет в публичном", async () => {
    const id = await createTestUser(`profile-own-${randomUUID()}@example.com`);
    await sql`update users set phone = '+79990000000' where id = ${id}`.execute(db);

    const own = await repository.findOwnProfile(id);
    expect(own?.phone).toBe("+79990000000");
    expect(own?.email).toContain("profile-own-");

    const publicView = await repository.findPublicProfile(id);
    if (publicView?.status !== "active") throw new Error("ожидался активный профиль");
    expect(publicView).not.toHaveProperty("phone");
    expect(publicView).not.toHaveProperty("email");
  });

  it("updateOwnProfile раскладывает displayName на имя и фамилию и обновляет остальные поля", async () => {
    const id = await createTestUser(`profile-update-${randomUUID()}@example.com`);

    const updated = await repository.updateOwnProfile(id, {
      displayName: "Анна Лебедева",
      aboutText: "Часто летаю Москва — Нячанг",
      phone: "+79991234567",
    });

    expect(updated.displayName).toBe("Анна Лебедева");
    expect(updated.aboutText).toBe("Часто летаю Москва — Нячанг");
    expect(updated.phone).toBe("+79991234567");

    const cleared = await repository.updateOwnProfile(id, { displayName: null });
    expect(cleared.displayName).toBeNull();
  });

  it("не трогает непереданные поля при частичном обновлении", async () => {
    const id = await createTestUser(`profile-partial-${randomUUID()}@example.com`);
    await repository.updateOwnProfile(id, { displayName: "Иван Иванов" });

    const afterAboutOnly = await repository.updateOwnProfile(id, { aboutText: "Только текст" });

    expect(afterAboutOnly.displayName).toBe("Иван Иванов");
    expect(afterAboutOnly.aboutText).toBe("Только текст");
  });

  it("setReferrer записывает реферера один раз и увеличивает счётчик у пригласившего", async () => {
    const referrerId = await createTestUser(`profile-referrer-${randomUUID()}@example.com`);
    const referredId = await createTestUser(`profile-referred-${randomUUID()}@example.com`);
    const otherId = await createTestUser(`profile-other-${randomUUID()}@example.com`);

    const before = await repository.findPublicProfile(referrerId);
    if (before?.status !== "active") throw new Error("ожидался активный профиль");
    const baseline = before.referredCount;

    const updated = await repository.setReferrer(referredId, referrerId);
    expect(updated.referredById).toBe(referrerId);

    const after = await repository.findPublicProfile(referrerId);
    if (after?.status !== "active") throw new Error("ожидался активный профиль");
    expect(after.referredCount).toBe(baseline + 1);

    // Повторный вызов с другим реферером не переписывает уже заданного (идемпотентность).
    const unchanged = await repository.setReferrer(referredId, otherId);
    expect(unchanged.referredById).toBe(referrerId);
  });
});
