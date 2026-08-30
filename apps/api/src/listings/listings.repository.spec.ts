import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseCitiesRepository } from "../directories/cities.repository.supabase.js";
import { SupabaseListingsRepository } from "./listings.repository.supabase.js";

describe("SupabaseListingsRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseListingsRepository;
  let cities: SupabaseCitiesRepository;
  let ownerId: string;
  let fromCityId: string;
  let toCityId: string;
  const createdListingIds: string[] = [];

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseListingsRepository(db);
    cities = new SupabaseCitiesRepository(db);

    // Тестовый пользователь через auth.users — profile в public.users
    // создаётся триггером автоматически (см. user-sessions.repository.spec.ts).
    ownerId = randomUUID();
    await sql`insert into auth.users (id, email) values (${ownerId}, ${`test-listings-${ownerId}@example.com`})`.execute(
      db,
    );
    await sql`update users set first_name = 'Тест', last_name = 'Тестов' where id = ${ownerId}`.execute(db);

    const seededCities = await cities.findAllActive();
    fromCityId = seededCities.find((c) => c.nameRu === "Москва")?.id ?? "";
    toCityId = seededCities.find((c) => c.nameRu === "Нячанг")?.id ?? "";
    expect(fromCityId).not.toBe("");
    expect(toCityId).not.toBe("");
  });

  afterAll(async () => {
    if (createdListingIds.length > 0) {
      await sql`delete from listings where id = any(${createdListingIds})`.execute(db);
    }
    await sql`delete from auth.users where id = ${ownerId}`.execute(db);
    await db.destroy();
  });

  it("создаёт объявление и находит его по id с подтянутыми городами и автором", async () => {
    const created = await repository.create({
      ownerId,
      type: "trip",
      fromCityId,
      toCityId,
      date: "2026-09-12",
      freeWeightKg: 8,
      pricePerKg: 1200,
      minPrice: 3000,
      description: "Есть немного места в чемодане",
    });
    createdListingIds.push(created.id);

    expect(created.fromCity).toBe("Москва");
    expect(created.toCity).toBe("Нячанг");
    expect(created.date).toBe("2026-09-12");
    expect(created.courier.name).toBe("Тест Тестов");
    expect(created.courier.verified).toBe(false);

    const found = await repository.findById(created.id);
    expect(found?.id).toBe(created.id);
  });

  it("возвращает null для несуществующего объявления", async () => {
    const found = await repository.findById(randomUUID());
    expect(found).toBeNull();
  });

  it("фильтрует список по типу и городу отправления", async () => {
    const trip = await repository.create({
      ownerId,
      type: "trip",
      fromCityId,
      toCityId,
      date: "2026-09-20",
      freeWeightKg: 5,
      pricePerKg: 1000,
      minPrice: 2000,
      description: "",
    });
    const request = await repository.create({
      ownerId,
      type: "request",
      fromCityId,
      toCityId,
      date: "2026-09-21",
      freeWeightKg: 2,
      pricePerKg: 900,
      minPrice: 1500,
      description: "",
    });
    createdListingIds.push(trip.id, request.id);

    const trips = await repository.findAll({ type: "trip", fromCityId });
    expect(trips.map((l) => l.id)).toContain(trip.id);
    expect(trips.map((l) => l.id)).not.toContain(request.id);
  });

  it("находит объявления по владельцу", async () => {
    const own = await repository.findByOwner(ownerId);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((l) => l.courier.id === ownerId)).toBe(true);
  });
});
