import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable, Updateable } from "kysely";
import { buildPaginatedResponse, type PaginatedResponse } from "../common/pagination.js";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ListingsTable } from "./listings.types.js";
import type { IListingsRepository } from "./listings.repository.js";
import { ACTIVE_LISTING_STATUSES } from "./listings.types.js";
import type {
  Listing,
  ListingFilter,
  ListingKind,
  ListingStatus,
  NewListing,
  UpdateListing,
} from "./listings.types.js";
import type { UsersTable } from "../auth/auth.types.js";

interface ListingRow {
  id: string;
  type: ListingKind;
  status: ListingStatus;
  date_from: Date;
  date_to: Date;
  weight_grams: number;
  price_per_kg_minor: number | null;
  min_price_minor: number | null;
  price_total_minor: number | null;
  pickup_instructions: string | null;
  dropoff_instructions: string | null;
  storage_until_date: Date | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  flight_number: string | null;
  item_description: string | null;
  comment: string | null;
  created_at: Date;
  from_city_id: string;
  from_city_name: string;
  to_city_id: string;
  to_city_name: string;
  currency_symbol: string;
  currency_code: string;
  currency_decimal_places: number;
  owner_id: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_email: string;
  owner_avatar_url: string | null;
  owner_verification_status: Selectable<UsersTable>["verification_status"];
}

function courierName(row: ListingRow): string {
  const fullName = [row.owner_first_name, row.owner_last_name].filter(Boolean).join(" ").trim();
  if (fullName.length > 0) {
    return fullName;
  }
  return row.owner_email.split("@")[0] ?? "Пользователь";
}

function courierInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/**
 * node-postgres парсит `date` в Date-объект с локальными год/месяц/день
 * (не UTC) — поэтому берём их локальными геттерами, а не toISOString(),
 * иначе дата может съехать на день в зависимости от часового пояса сервера.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMajorUnits(minor: number | null, decimalPlaces: number): number | null {
  if (minor === null) return null;
  return minor / 10 ** decimalPlaces;
}

function toEntity(row: ListingRow): Listing {
  const name = courierName(row);
  const decimals = row.currency_decimal_places;

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    fromCityId: row.from_city_id,
    fromCity: row.from_city_name,
    toCityId: row.to_city_id,
    toCity: row.to_city_name,
    dateFrom: formatDate(new Date(row.date_from)),
    dateTo: formatDate(new Date(row.date_to)),
    weightKg: row.weight_grams / 1000,
    currency: row.currency_symbol,
    currencyCode: row.currency_code,
    pricePerKg: toMajorUnits(row.price_per_kg_minor, decimals),
    minPrice: toMajorUnits(row.min_price_minor, decimals),
    priceTotal: toMajorUnits(row.price_total_minor, decimals),
    pickupInstructions: row.pickup_instructions,
    dropoffInstructions: row.dropoff_instructions,
    storageUntilDate: row.storage_until_date ? formatDate(new Date(row.storage_until_date)) : null,
    departureAirport: row.departure_airport,
    arrivalAirport: row.arrival_airport,
    flightNumber: row.flight_number,
    itemDescription: row.item_description,
    comment: row.comment,
    createdAt: new Date(row.created_at),
    courier: {
      id: row.owner_id,
      name,
      initials: courierInitials(name),
      avatarUrl: row.owner_avatar_url,
      verified: row.owner_verification_status === "approved",
      // Рейтинг и число сделок появятся вместе с E11 (отзывы) — пока заглушка.
      rating: 0,
      dealsCount: 0,
    },
  };
}

/** camelCase-поле UpdateListing → колонка ListingsTable, для частичного PATCH. */
function toUpdateableRow(input: UpdateListing): Updateable<ListingsTable> {
  const row: Updateable<ListingsTable> = {};
  if (input.fromCityId !== undefined) row.from_city_id = input.fromCityId;
  if (input.toCityId !== undefined) row.to_city_id = input.toCityId;
  if (input.currencyId !== undefined) row.currency_id = input.currencyId;
  if (input.dateFrom !== undefined) row.date_from = input.dateFrom;
  if (input.dateTo !== undefined) row.date_to = input.dateTo;
  if (input.weightGrams !== undefined) row.weight_grams = input.weightGrams;
  if (input.pricePerKgMinor !== undefined) row.price_per_kg_minor = input.pricePerKgMinor;
  if (input.minPriceMinor !== undefined) row.min_price_minor = input.minPriceMinor;
  if (input.priceTotalMinor !== undefined) row.price_total_minor = input.priceTotalMinor;
  if (input.pickupInstructions !== undefined) row.pickup_instructions = input.pickupInstructions;
  if (input.dropoffInstructions !== undefined) row.dropoff_instructions = input.dropoffInstructions;
  if (input.storageUntilDate !== undefined) row.storage_until_date = input.storageUntilDate;
  if (input.departureAirport !== undefined) row.departure_airport = input.departureAirport;
  if (input.arrivalAirport !== undefined) row.arrival_airport = input.arrivalAirport;
  if (input.flightNumber !== undefined) row.flight_number = input.flightNumber;
  if (input.itemDescription !== undefined) row.item_description = input.itemDescription;
  if (input.comment !== undefined) row.comment = input.comment;
  return row;
}

@Injectable()
export class SupabaseListingsRepository implements IListingsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  private baseQuery(executor: Executor) {
    return executor
      .selectFrom("listings")
      .innerJoin("cities as from_city", "from_city.id", "listings.from_city_id")
      .innerJoin("cities as to_city", "to_city.id", "listings.to_city_id")
      .innerJoin("currencies", "currencies.id", "listings.currency_id")
      .innerJoin("users", "users.id", "listings.owner_id")
      .select([
        "listings.id as id",
        "listings.type as type",
        "listings.status as status",
        "listings.date_from as date_from",
        "listings.date_to as date_to",
        "listings.weight_grams as weight_grams",
        "listings.price_per_kg_minor as price_per_kg_minor",
        "listings.min_price_minor as min_price_minor",
        "listings.price_total_minor as price_total_minor",
        "listings.pickup_instructions as pickup_instructions",
        "listings.dropoff_instructions as dropoff_instructions",
        "listings.storage_until_date as storage_until_date",
        "listings.departure_airport as departure_airport",
        "listings.arrival_airport as arrival_airport",
        "listings.flight_number as flight_number",
        "listings.item_description as item_description",
        "listings.comment as comment",
        "listings.created_at as created_at",
        "from_city.id as from_city_id",
        "from_city.name_ru as from_city_name",
        "to_city.id as to_city_id",
        "to_city.name_ru as to_city_name",
        "currencies.symbol as currency_symbol",
        "currencies.code as currency_code",
        "currencies.decimal_places as currency_decimal_places",
        "users.id as owner_id",
        "users.first_name as owner_first_name",
        "users.last_name as owner_last_name",
        "users.email as owner_email",
        "users.avatar_url as owner_avatar_url",
        "users.verification_status as owner_verification_status",
      ]);
  }

  async findAll(
    filter: ListingFilter,
    executor: Executor = this.db,
  ): Promise<PaginatedResponse<Listing>> {
    const sortByPrice = filter.sortBy === "price";

    let query = this.baseQuery(executor).where("listings.status", "=", "published");

    if (filter.type) {
      query = query.where("listings.type", "=", filter.type);
    }
    if (filter.fromCityId) {
      query = query.where("listings.from_city_id", "=", filter.fromCityId);
    }
    if (filter.toCityId) {
      query = query.where("listings.to_city_id", "=", filter.toCityId);
    }
    if (filter.ownerId) {
      query = query.where("listings.owner_id", "=", filter.ownerId);
    }
    if (filter.currencyCode) {
      query = query.where("currencies.code", "=", filter.currencyCode);
    }
    if (filter.verifiedOnly) {
      query = query.where("users.verification_status", "=", "approved");
    }
    if (filter.weightMinGrams !== undefined) {
      query = query.where("listings.weight_grams", ">=", filter.weightMinGrams);
    }
    if (filter.priceMaxPerKgMinor !== undefined) {
      query = query.where("listings.price_per_kg_minor", "<=", filter.priceMaxPerKgMinor);
    }
    if (filter.dateFrom) {
      query = query.where("listings.date_to", ">=", new Date(`${filter.dateFrom}T00:00:00Z`));
    }
    if (filter.dateTo) {
      query = query.where("listings.date_from", "<=", new Date(`${filter.dateTo}T00:00:00Z`));
    }
    // Сортировка по цене (ТЗ п.8.7) ранжирует только то, у чего цена вообще
    // есть — заявки без указанной цены за кг сюда не попадают, зато остаются
    // в выдаче по умолчанию (сортировка по дате).
    if (sortByPrice) {
      query = query.where("listings.price_per_kg_minor", "is not", null);
    }

    if (filter.cursor) {
      const cursorId = filter.cursor.id;
      if (sortByPrice) {
        const cursorPrice = Number(filter.cursor.sortValue);
        query = query.where((eb) =>
          eb.or([
            eb("listings.price_per_kg_minor", ">", cursorPrice),
            eb.and([
              eb("listings.price_per_kg_minor", "=", cursorPrice),
              eb("listings.id", ">", cursorId),
            ]),
          ]),
        );
      } else {
        const cursorDate = new Date(`${filter.cursor.sortValue}T00:00:00Z`);
        query = query.where((eb) =>
          eb.or([
            eb("listings.date_from", ">", cursorDate),
            eb.and([eb("listings.date_from", "=", cursorDate), eb("listings.id", ">", cursorId)]),
          ]),
        );
      }
    }

    query = sortByPrice
      ? query.orderBy("listings.price_per_kg_minor", "asc").orderBy("listings.id", "asc")
      : query.orderBy("listings.date_from", "asc").orderBy("listings.id", "asc");

    const rows = (await query.limit(filter.limit + 1).execute()) as ListingRow[];
    const hasMore = rows.length > filter.limit;
    const pageRows = hasMore ? rows.slice(0, filter.limit) : rows;
    const items = pageRows.map((row) => toEntity(row));

    let nextCursorPayload: Record<string, unknown> | null = null;
    if (hasMore) {
      const last = pageRows[pageRows.length - 1]!;
      const sortValue = sortByPrice ? String(last.price_per_kg_minor) : formatDate(new Date(last.date_from));
      nextCursorPayload = { sortValue, id: last.id };
    }

    return buildPaginatedResponse(items, nextCursorPayload);
  }

  async findById(id: string, executor: Executor = this.db): Promise<Listing | null> {
    const row = await this.baseQuery(executor).where("listings.id", "=", id).executeTakeFirst();
    return row ? toEntity(row as ListingRow) : null;
  }

  async findByOwner(ownerId: string, executor: Executor = this.db): Promise<Listing[]> {
    const rows = await this.baseQuery(executor)
      .where("listings.owner_id", "=", ownerId)
      .orderBy("listings.created_at", "desc")
      .execute();
    return rows.map((row) => toEntity(row as ListingRow));
  }

  async countActiveByOwnerAndType(
    ownerId: string,
    type: ListingKind,
    executor: Executor = this.db,
  ): Promise<number> {
    const result = await executor
      .selectFrom("listings")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("owner_id", "=", ownerId)
      .where("type", "=", type)
      .where("status", "in", ACTIVE_LISTING_STATUSES)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async create(input: NewListing, executor: Executor = this.db): Promise<Listing> {
    const inserted = await executor
      .insertInto("listings")
      .values({
        owner_id: input.ownerId,
        type: input.type,
        from_city_id: input.fromCityId,
        to_city_id: input.toCityId,
        currency_id: input.currencyId,
        date_from: input.dateFrom,
        date_to: input.dateTo,
        weight_grams: input.weightGrams,
        price_per_kg_minor: input.pricePerKgMinor,
        min_price_minor: input.minPriceMinor,
        price_total_minor: input.priceTotalMinor,
        pickup_instructions: input.pickupInstructions,
        dropoff_instructions: input.dropoffInstructions,
        storage_until_date: input.storageUntilDate,
        departure_airport: input.departureAirport,
        arrival_airport: input.arrivalAirport,
        flight_number: input.flightNumber,
        item_description: input.itemDescription,
        comment: input.comment,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const created = await this.findById(inserted.id, executor);
    if (!created) {
      throw new Error("Объявление не найдено сразу после создания");
    }
    return created;
  }

  async update(id: string, input: UpdateListing, executor: Executor = this.db): Promise<Listing> {
    const row = toUpdateableRow(input);
    if (Object.keys(row).length > 0) {
      await executor.updateTable("listings").set(row).where("id", "=", id).execute();
    }
    const updated = await this.findById(id, executor);
    if (!updated) {
      throw new Error("Объявление не найдено после обновления");
    }
    return updated;
  }

  async setStatus(
    id: string,
    status: ListingStatus,
    executor: Executor = this.db,
  ): Promise<Listing> {
    await executor.updateTable("listings").set({ status }).where("id", "=", id).execute();
    const updated = await this.findById(id, executor);
    if (!updated) {
      throw new Error("Объявление не найдено после смены статуса");
    }
    return updated;
  }

  async findExpiredPublishedIds(
    asOfDate: string,
    executor: Executor = this.db,
  ): Promise<string[]> {
    const cutoff = new Date(`${asOfDate}T00:00:00Z`);
    const rows = await executor
      .selectFrom("listings")
      .select("id")
      .where("status", "=", "published")
      .where((eb) =>
        eb.or([
          eb.and([eb("type", "=", "trip"), eb("date_from", "<", cutoff)]),
          eb.and([eb("type", "=", "request"), eb("date_to", "<", cutoff)]),
        ]),
      )
      .execute();
    return rows.map((row) => row.id);
  }

  async countActiveRequestsOnRoute(
    fromCityId: string,
    toCityId: string,
    executor: Executor = this.db,
  ): Promise<number> {
    const result = await executor
      .selectFrom("listings")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("status", "=", "published")
      .where("type", "=", "request")
      .where("from_city_id", "=", fromCityId)
      .where("to_city_id", "=", toCityId)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async findNearbyDates(
    params: { type: ListingKind; fromCityId: string; toCityId: string; aroundDate: string },
    executor: Executor = this.db,
  ): Promise<string[]> {
    const center = new Date(`${params.aroundDate}T00:00:00Z`);
    const from = new Date(center);
    from.setUTCDate(from.getUTCDate() - 7);
    const to = new Date(center);
    to.setUTCDate(to.getUTCDate() + 7);

    const rows = await executor
      .selectFrom("listings")
      .select("date_from")
      .distinct()
      .where("status", "=", "published")
      .where("type", "=", params.type)
      .where("from_city_id", "=", params.fromCityId)
      .where("to_city_id", "=", params.toCityId)
      .where("date_from", ">=", from)
      .where("date_from", "<=", to)
      .where("date_from", "!=", center)
      .orderBy("date_from", "asc")
      .execute();

    return rows.map((row) => formatDate(new Date(row.date_from)));
  }

  async reserveWeight(listingId: string, grams: number, executor: Executor): Promise<boolean> {
    const row = await executor
      .selectFrom("listings")
      .select("weight_grams")
      .where("id", "=", listingId)
      .forUpdate()
      .executeTakeFirst();

    if (!row || row.weight_grams < grams) {
      return false;
    }

    await executor
      .updateTable("listings")
      .set({ weight_grams: row.weight_grams - grams })
      .where("id", "=", listingId)
      .execute();
    return true;
  }

  async releaseWeight(listingId: string, grams: number, executor: Executor = this.db): Promise<void> {
    if (grams <= 0) return;
    await executor
      .updateTable("listings")
      .set((eb) => ({ weight_grams: eb("weight_grams", "+", grams) }))
      .where("id", "=", listingId)
      .execute();
  }
}
