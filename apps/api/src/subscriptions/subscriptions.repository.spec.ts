import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseCitiesRepository } from "../directories/cities.repository.supabase.js";
import { SupabaseSubscriptionsRepository } from "./subscriptions.repository.supabase.js";

describe("SupabaseSubscriptionsRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseSubscriptionsRepository;
  let userId: string;
  let moscowId: string;
  let nhaTrangId: string;
  let bishkekId: string;
  const createdSubscriptionIds: string[] = [];
  const createdListingIds: string[] = [];

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseSubscriptionsRepository(db);
    const cities = new SupabaseCitiesRepository(db);

    userId = randomUUID();
    await sql`insert into auth.users (id, email) values (${userId}, ${`test-subs-${userId}@example.com`})`.execute(db);

    const seededCities = await cities.findAllActive();
    moscowId = seededCities.find((c) => c.nameRu === "Москва")?.id ?? "";
    nhaTrangId = seededCities.find((c) => c.nameRu === "Нячанг")?.id ?? "";
    bishkekId = seededCities.find((c) => c.nameRu === "Бишкек")?.id ?? "";
    expect(moscowId).not.toBe("");
    expect(nhaTrangId).not.toBe("");
    expect(bishkekId).not.toBe("");
  });

  afterAll(async () => {
    if (createdListingIds.length > 0) {
      await sql`delete from listings where id = any(${createdListingIds})`.execute(db);
    }
    if (createdSubscriptionIds.length > 0) {
      await sql`delete from route_subscriptions where id = any(${createdSubscriptionIds})`.execute(db);
    }
    await sql`delete from auth.users where id = ${userId}`.execute(db);
    await db.destroy();
  });

  async function createTestListing(overrides: Record<string, unknown> = {}): Promise<string> {
    const rub = await sql<{
      id: string;
    }>`select id from currencies where code = 'RUB'`.execute(db);
    const currencyId = rub.rows[0]!.id;
    const id = randomUUID();
    await sql`
      insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor)
      values (${id}, ${userId}, ${overrides["type"] ?? "trip"}, ${overrides["fromCityId"] ?? moscowId}, ${overrides["toCityId"] ?? nhaTrangId}, ${currencyId}, ${overrides["dateFrom"] ?? "2026-09-12"}, ${overrides["dateTo"] ?? "2026-09-12"}, 5000, 100000, 300000)
    `.execute(db);
    createdListingIds.push(id);
    return id;
  }

  it("создаёт подписку и находит её у пользователя с нулём совпадений", async () => {
    const created = await repository.create({
      userId,
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      dateFrom: null,
      dateTo: null,
      listingType: null,
    });
    createdSubscriptionIds.push(created.id);

    expect(created.fromCity).toBe("Москва");
    expect(created.toCity).toBe("Нячанг");
    expect(created.isActive).toBe(true);
    expect(created.matchCount).toBe(0);

    const count = await repository.countByUser(userId);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("recordMatches находит активную подписку без ограничений и накапливает счётчик", async () => {
    const subscription = await repository.create({
      userId,
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      dateFrom: null,
      dateTo: null,
      listingType: null,
    });
    createdSubscriptionIds.push(subscription.id);

    const listingId = await createTestListing();
    const matched = await repository.recordMatches({
      id: listingId,
      type: "trip",
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      dateFrom: "2026-09-12",
      dateTo: "2026-09-12",
    });
    expect(matched).toBeGreaterThanOrEqual(1);

    const thisOne = (await repository.findByUser(userId)).find((s) => s.id === subscription.id);
    expect(thisOne?.matchCount).toBeGreaterThanOrEqual(1);
  });

  it("recordMatches не совпадает по чужому маршруту или несовпадающему типу", async () => {
    const subscription = await repository.create({
      userId,
      fromCityId: moscowId,
      toCityId: bishkekId,
      dateFrom: null,
      dateTo: null,
      listingType: "request",
    });
    createdSubscriptionIds.push(subscription.id);

    // Реальные объявления — этот маршрут (moscow→nhaTrang) мог уже совпасть
    // с подписками из предыдущих тестов файла (listingType: null там ловит
    // любой тип), а fake id без строки в listings уронил бы insert по FK.
    const otherRouteListingId = await createTestListing({
      type: "request",
      fromCityId: moscowId,
      toCityId: nhaTrangId,
    });
    // Другой маршрут относительно ЭТОЙ подписки — не должно совпасть с ней.
    await repository.recordMatches({
      id: otherRouteListingId,
      type: "request",
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      dateFrom: "2026-09-12",
      dateTo: "2026-09-12",
    });

    const wrongTypeListingId = await createTestListing({
      type: "trip",
      fromCityId: moscowId,
      toCityId: bishkekId,
    });
    // Тот же маршрут, что у подписки, но тип не совпадает с её фильтром.
    await repository.recordMatches({
      id: wrongTypeListingId,
      type: "trip",
      fromCityId: moscowId,
      toCityId: bishkekId,
      dateFrom: "2026-09-12",
      dateTo: "2026-09-12",
    });

    const reloaded = (await repository.findByUser(userId)).find((s) => s.id === subscription.id);
    expect(reloaded?.matchCount).toBe(0);
  });

  it("повторная запись того же совпадения не дублируется (unique constraint)", async () => {
    const subscription = await repository.create({
      userId,
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      dateFrom: null,
      dateTo: null,
      listingType: null,
    });
    createdSubscriptionIds.push(subscription.id);

    const listingId = await createTestListing();
    const candidate = {
      id: listingId,
      type: "trip" as const,
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      dateFrom: "2026-09-12",
      dateTo: "2026-09-12",
    };
    await repository.recordMatches(candidate);
    await repository.recordMatches(candidate);

    const reloaded = (await repository.findByUser(userId)).find((s) => s.id === subscription.id);
    expect(reloaded?.matchCount).toBe(1);
  });

  it("setActive выключает подписку, delete удаляет её", async () => {
    const subscription = await repository.create({
      userId,
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      dateFrom: null,
      dateTo: null,
      listingType: null,
    });

    const disabled = await repository.setActive(subscription.id, false);
    expect(disabled.isActive).toBe(false);

    await repository.delete(subscription.id);
    const found = await repository.findOwned(subscription.id, userId);
    expect(found).toBeNull();
  });
});
