import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseCitiesRepository } from "./cities.repository.supabase.js";

describe("SupabaseCitiesRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseCitiesRepository;

  beforeAll(() => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseCitiesRepository(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it("отдаёт 15 активных городов из начального наполнения", async () => {
    const cities = await repository.findAllActive();
    expect(cities).toHaveLength(15);
    expect(cities[0]?.nameRu).toBe("Нячанг");
  });

  it.each(["нячанг", "Nha Trang", "камрань", "yzxfyu"])(
    "запрос «%s» находит Нячанг (E05 п. 5.2, критерий приёмки)",
    async (query) => {
      const results = await repository.search(query);
      expect(results.map((c) => c.nameRu)).toContain("Нячанг");
    },
  );

  it("не находит несуществующий город", async () => {
    const results = await repository.search("Токио");
    expect(results).toHaveLength(0);
  });

  it("создаёт, правит и отключает город (E05 п. 5.6 — CRUD для админки)", async () => {
    const created = await repository.create({
      nameRu: "Тестоград",
      nameEn: "Testograd",
      countryCode: "RU",
      timezone: "Europe/Moscow",
      synonyms: ["Testograd City"],
    });

    try {
      expect(created.isActive).toBe(true);
      expect(created.nameRu).toBe("Тестоград");

      const updated = await repository.update(created.id, { nameRu: "Тестоград-2" });
      expect(updated?.nameRu).toBe("Тестоград-2");
      expect(updated?.nameEn).toBe("Testograd");

      // Отключённый город не появляется в поиске и в списке активных (5.3).
      const deactivated = await repository.setActive(created.id, false);
      expect(deactivated?.isActive).toBe(false);

      const activeCities = await repository.findAllActive();
      expect(activeCities.map((c) => c.id)).not.toContain(created.id);

      const searchResults = await repository.search("Тестоград");
      expect(searchResults.map((c) => c.id)).not.toContain(created.id);

      // Но всё ещё виден через findAll/findById — существующие объявления
      // с этим городом не должны сломаться (5.3).
      const stillFindable = await repository.findById(created.id);
      expect(stillFindable?.isActive).toBe(false);
    } finally {
      await sql`delete from cities where id = ${created.id}`.execute(db);
    }
  });
});
