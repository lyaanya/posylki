import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeCursor } from "../common/pagination.js";
import { createDatabase, runInTransaction, type DB } from "../database/database.js";
import { SupabaseCitiesRepository } from "../directories/cities.repository.supabase.js";
import { SupabaseCurrenciesRepository } from "../directories/currencies.repository.supabase.js";
import { SupabaseListingsRepository } from "./listings.repository.supabase.js";
import type { NewListing } from "./listings.types.js";

describe("SupabaseListingsRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseListingsRepository;
  let ownerId: string;
  let moscowId: string;
  let nhaTrangId: string;
  let rubId: string;
  const createdListingIds: string[] = [];

  function baseTrip(overrides: Partial<NewListing> = {}): NewListing {
    return {
      ownerId,
      type: "trip",
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      currencyId: rubId,
      dateFrom: "2026-09-12",
      dateTo: "2026-09-13",
      weightGrams: 8000,
      pricePerKgMinor: 120_000,
      minPriceMinor: 300_000,
      priceTotalMinor: null,
      pickupInstructions: "У метро Тверская, вечером",
      dropoffInstructions: "В центре Нячанга, днём",
      storageUntilDate: "2026-09-20",
      departureAirport: "SVO",
      arrivalAirport: "CXR",
      flightNumber: "SU270",
      itemDescription: null,
      comment: "Есть немного места в чемодане",
      ...overrides,
    };
  }

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseListingsRepository(db);
    const cities = new SupabaseCitiesRepository(db);
    const currencies = new SupabaseCurrenciesRepository(db);

    ownerId = randomUUID();
    await sql`insert into auth.users (id, email) values (${ownerId}, ${`test-listings-${ownerId}@example.com`})`.execute(
      db,
    );
    await sql`update users set first_name = 'Тест', last_name = 'Тестов' where id = ${ownerId}`.execute(db);

    const seededCities = await cities.findAllActive();
    moscowId = seededCities.find((c) => c.nameRu === "Москва")?.id ?? "";
    nhaTrangId = seededCities.find((c) => c.nameRu === "Нячанг")?.id ?? "";
    expect(moscowId).not.toBe("");
    expect(nhaTrangId).not.toBe("");

    const rub = await currencies.findByCode("RUB");
    rubId = rub?.id ?? "";
    expect(rubId).not.toBe("");
  });

  afterAll(async () => {
    if (createdListingIds.length > 0) {
      await sql`delete from listings where id = any(${createdListingIds})`.execute(db);
    }
    await sql`delete from auth.users where id = ${ownerId}`.execute(db);
    await db.destroy();
  });

  it("создаёт рейс и переводит граммы/минорные единицы обратно в кг/рубли при чтении", async () => {
    const created = await repository.create(baseTrip());
    createdListingIds.push(created.id);

    expect(created.fromCity).toBe("Москва");
    expect(created.toCity).toBe("Нячанг");
    expect(created.dateFrom).toBe("2026-09-12");
    expect(created.dateTo).toBe("2026-09-13");
    expect(created.weightKg).toBe(8);
    expect(created.pricePerKg).toBe(1200);
    expect(created.minPrice).toBe(3000);
    expect(created.currency).toBe("₽");
    expect(created.currencyCode).toBe("RUB");
    expect(created.pickupInstructions).toBe("У метро Тверская, вечером");
    expect(created.flightNumber).toBe("SU270");
    expect(created.status).toBe("published");
    expect(created.courier.name).toBe("Тест Тестов");
  });

  it("создаёт заявку без цены за кг и минимума, с обязательным описанием груза", async () => {
    const created = await repository.create(
      baseTrip({
        type: "request",
        pricePerKgMinor: null,
        minPriceMinor: null,
        priceTotalMinor: 500_000,
        pickupInstructions: null,
        dropoffInstructions: null,
        storageUntilDate: null,
        departureAirport: null,
        arrivalAirport: null,
        flightNumber: null,
        itemDescription: "Коробка с лекарствами",
      }),
    );
    createdListingIds.push(created.id);

    expect(created.type).toBe("request");
    expect(created.pricePerKg).toBeNull();
    expect(created.minPrice).toBeNull();
    expect(created.priceTotal).toBe(5000);
    expect(created.itemDescription).toBe("Коробка с лекарствами");
  });

  it("findAll отдаёт только опубликованные, findByOwner — все статусы", async () => {
    const published = await repository.create(baseTrip());
    const hidden = await repository.create(baseTrip());
    createdListingIds.push(published.id, hidden.id);
    await repository.setStatus(hidden.id, "hidden_by_author");

    const feed = await repository.findAll({ ownerId, limit: 20 });
    expect(feed.items.map((l) => l.id)).toContain(published.id);
    expect(feed.items.map((l) => l.id)).not.toContain(hidden.id);

    const mine = await repository.findByOwner(ownerId);
    expect(mine.map((l) => l.id)).toContain(published.id);
    expect(mine.map((l) => l.id)).toContain(hidden.id);
  });

  it("countActiveByOwnerAndType не считает архивные и снятые модератором", async () => {
    const before = await repository.countActiveByOwnerAndType(ownerId, "trip");

    const active = await repository.create(baseTrip());
    const archived = await repository.create(baseTrip());
    createdListingIds.push(active.id, archived.id);
    await repository.setStatus(archived.id, "archived");

    const after = await repository.countActiveByOwnerAndType(ownerId, "trip");
    expect(after).toBe(before + 1);
  });

  it("update меняет только переданные поля", async () => {
    const created = await repository.create(baseTrip());
    createdListingIds.push(created.id);

    const updated = await repository.update(created.id, { weightGrams: 10_000 });

    expect(updated.weightKg).toBe(10);
    expect(updated.pricePerKg).toBe(1200); // не тронуто
    expect(updated.pickupInstructions).toBe("У метро Тверская, вечером"); // не тронуто
  });

  it("findExpiredPublishedIds находит рейс по дате вылета и заявку по концу диапазона", async () => {
    const pastTrip = await repository.create(baseTrip({ dateFrom: "2020-01-01", dateTo: "2020-01-02" }));
    const futureTrip = await repository.create(baseTrip({ dateFrom: "2099-01-01", dateTo: "2099-01-02" }));
    const pastRequest = await repository.create(
      baseTrip({
        type: "request",
        dateFrom: "2020-01-01",
        dateTo: "2020-01-05",
        pricePerKgMinor: null,
        minPriceMinor: null,
        itemDescription: "Что-то",
      }),
    );
    createdListingIds.push(pastTrip.id, futureTrip.id, pastRequest.id);

    const expired = await repository.findExpiredPublishedIds("2026-01-01");

    expect(expired).toContain(pastTrip.id);
    expect(expired).toContain(pastRequest.id);
    expect(expired).not.toContain(futureTrip.id);
  });

  it("findAll с limit отдаёт nextCursor, а следующая страница по нему — остаток без повторов", async () => {
    const a = await repository.create(baseTrip({ dateFrom: "2027-01-10", dateTo: "2027-01-10" }));
    const b = await repository.create(baseTrip({ dateFrom: "2027-01-11", dateTo: "2027-01-11" }));
    const c = await repository.create(baseTrip({ dateFrom: "2027-01-12", dateTo: "2027-01-12" }));
    createdListingIds.push(a.id, b.id, c.id);

    // dateFrom/dateTo сужают выборку до этих трёх объявлений — иначе более
    // ранние объявления из прошлых тестов (тот же владелец и маршрут)
    // окажутся раньше них при сортировке по возрастанию даты.
    const scoped = { ownerId, dateFrom: "2027-01-01", dateTo: "2027-01-31" };

    const firstPage = await repository.findAll({ ...scoped, limit: 2 });
    expect(firstPage.items.map((l) => l.id)).toEqual([a.id, b.id]);
    expect(firstPage.next_cursor).not.toBeNull();

    const decoded = decodeCursor<{ sortValue: string; id: string }>(firstPage.next_cursor!);

    const secondPage = await repository.findAll({
      ...scoped,
      limit: 2,
      cursor: decoded,
    });
    expect(secondPage.items.map((l) => l.id)).toContain(c.id);
    expect(secondPage.items.map((l) => l.id)).not.toContain(a.id);
    expect(secondPage.items.map((l) => l.id)).not.toContain(b.id);
  });

  it("verifiedOnly отсекает объявления непроверенных владельцев", async () => {
    const listing = await repository.create(baseTrip());
    createdListingIds.push(listing.id);

    const withoutFilter = await repository.findAll({ ownerId, limit: 20 });
    expect(withoutFilter.items.map((l) => l.id)).toContain(listing.id);

    const verifiedOnly = await repository.findAll({ ownerId, verifiedOnly: true, limit: 20 });
    expect(verifiedOnly.items.map((l) => l.id)).not.toContain(listing.id);
  });

  it("weightMinGrams и диапазон дат фильтруют выдачу", async () => {
    const light = await repository.create(baseTrip({ weightGrams: 2000, dateFrom: "2027-03-01", dateTo: "2027-03-01" }));
    const heavy = await repository.create(baseTrip({ weightGrams: 15_000, dateFrom: "2027-03-01", dateTo: "2027-03-01" }));
    createdListingIds.push(light.id, heavy.id);

    const heavyOnly = await repository.findAll({ ownerId, weightMinGrams: 10_000, limit: 20 });
    expect(heavyOnly.items.map((l) => l.id)).toContain(heavy.id);
    expect(heavyOnly.items.map((l) => l.id)).not.toContain(light.id);

    const inRange = await repository.findAll({
      ownerId,
      dateFrom: "2027-02-25",
      dateTo: "2027-03-05",
      limit: 20,
    });
    expect(inRange.items.map((l) => l.id)).toContain(light.id);

    const outOfRange = await repository.findAll({
      ownerId,
      dateFrom: "2028-01-01",
      dateTo: "2028-01-05",
      limit: 20,
    });
    expect(outOfRange.items.map((l) => l.id)).not.toContain(light.id);
  });

  it("countActiveRequestsOnRoute считает только опубликованные заявки на маршруте", async () => {
    const before = await repository.countActiveRequestsOnRoute(moscowId, nhaTrangId);
    const request = await repository.create(
      baseTrip({
        type: "request",
        pricePerKgMinor: null,
        minPriceMinor: null,
        itemDescription: "Что-то нужное",
      }),
    );
    createdListingIds.push(request.id);

    const after = await repository.countActiveRequestsOnRoute(moscowId, nhaTrangId);
    expect(after).toBe(before + 1);
  });

  it("findNearbyDates находит даты в пределах ±7 дней на том же маршруте и типе", async () => {
    const near = await repository.create(baseTrip({ dateFrom: "2027-05-10", dateTo: "2027-05-10" }));
    const far = await repository.create(baseTrip({ dateFrom: "2027-06-10", dateTo: "2027-06-10" }));
    createdListingIds.push(near.id, far.id);

    const nearbyDates = await repository.findNearbyDates({
      type: "trip",
      fromCityId: moscowId,
      toCityId: nhaTrangId,
      aroundDate: "2027-05-05",
    });

    expect(nearbyDates).toContain("2027-05-10");
    expect(nearbyDates).not.toContain("2027-06-10");
  });

  it(
    "reserveWeight: гонка двух сделок не ломает остаток — ровно одна проходит, если суммарно не хватает места",
    async () => {
      const listing = await repository.create(baseTrip({ weightGrams: 5000 }));
      createdListingIds.push(listing.id);

      // Каждая заявка сама по себе укладывается (3000 <= 5000), но вместе — нет
      // (3000 + 3000 > 5000). Гонка должна пропустить ровно одну.
      const results = await Promise.all([
        runInTransaction(db, (trx) => repository.reserveWeight(listing.id, 3000, trx)),
        runInTransaction(db, (trx) => repository.reserveWeight(listing.id, 3000, trx)),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      const after = await repository.findById(listing.id);
      expect(after?.weightKg).toBe(2);
    },
    15000,
  );

  it(
    "reserveWeight: три сделки по одному рейсу корректно уменьшают свободный вес",
    async () => {
      const listing = await repository.create(baseTrip({ weightGrams: 8000 }));
      createdListingIds.push(listing.id);

      for (const grams of [2000, 3000, 1500]) {
        const ok = await runInTransaction(db, (trx) => repository.reserveWeight(listing.id, grams, trx));
        expect(ok).toBe(true);
      }

      const after = await repository.findById(listing.id);
      expect(after?.weightKg).toBe(1.5); // 8 - 2 - 3 - 1.5

      const rejected = await runInTransaction(db, (trx) => repository.reserveWeight(listing.id, 2000, trx));
      expect(rejected).toBe(false);
    },
    15000,
  );

  it("releaseWeight возвращает вес обратно в рейс", async () => {
    const listing = await repository.create(baseTrip({ weightGrams: 4000 }));
    createdListingIds.push(listing.id);

    await runInTransaction(db, (trx) => repository.reserveWeight(listing.id, 3000, trx));
    await repository.releaseWeight(listing.id, 1000);

    const after = await repository.findById(listing.id);
    expect(after?.weightKg).toBe(2); // 4 - 3 + 1
  });
});
