import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IListingsRepository } from "./listings.repository.js";
import type { Listing, ListingFilter, NewListing } from "./listings.types.js";
import type { UsersTable } from "../auth/auth.types.js";

/** Валюта пока не выбирается при создании объявления — единственная в демо-срезе. */
const DEFAULT_CURRENCY = "₽";

interface ListingRow {
  id: string;
  type: "trip" | "request";
  travel_date: Date;
  free_weight_kg: number;
  price_per_kg: number;
  min_price: number;
  description: string;
  created_at: Date;
  from_city_name: string;
  to_city_name: string;
  owner_id: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_email: string;
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
 * (не UTC) — poэтому берём их локальными геттерами, а не toISOString(),
 * иначе дата может съехать на день в зависимости от часового пояса сервера.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toEntity(row: ListingRow): Listing {
  const name = courierName(row);

  return {
    id: row.id,
    type: row.type,
    fromCity: row.from_city_name,
    toCity: row.to_city_name,
    date: formatDate(new Date(row.travel_date)),
    freeWeightKg: Number(row.free_weight_kg),
    pricePerKg: Number(row.price_per_kg),
    minPrice: Number(row.min_price),
    currency: DEFAULT_CURRENCY,
    description: row.description,
    createdAt: new Date(row.created_at),
    courier: {
      id: row.owner_id,
      name,
      initials: courierInitials(name),
      verified: row.owner_verification_status === "approved",
      // Рейтинг и число сделок появятся вместе с E11 (отзывы) — пока заглушка.
      rating: 0,
      dealsCount: 0,
    },
  };
}

@Injectable()
export class SupabaseListingsRepository implements IListingsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  private baseQuery(executor: Executor) {
    return executor
      .selectFrom("listings")
      .innerJoin("cities as from_city", "from_city.id", "listings.from_city_id")
      .innerJoin("cities as to_city", "to_city.id", "listings.to_city_id")
      .innerJoin("users", "users.id", "listings.owner_id")
      .select([
        "listings.id as id",
        "listings.type as type",
        "listings.travel_date as travel_date",
        "listings.free_weight_kg as free_weight_kg",
        "listings.price_per_kg as price_per_kg",
        "listings.min_price as min_price",
        "listings.description as description",
        "listings.created_at as created_at",
        "from_city.name_ru as from_city_name",
        "to_city.name_ru as to_city_name",
        "users.id as owner_id",
        "users.first_name as owner_first_name",
        "users.last_name as owner_last_name",
        "users.email as owner_email",
        "users.verification_status as owner_verification_status",
      ]);
  }

  async findAll(filter: ListingFilter, executor: Executor = this.db): Promise<Listing[]> {
    let query = this.baseQuery(executor);

    if (filter.type) {
      query = query.where("listings.type", "=", filter.type);
    }
    if (filter.fromCityId) {
      query = query.where("listings.from_city_id", "=", filter.fromCityId);
    }
    if (filter.toCityId) {
      query = query.where("listings.to_city_id", "=", filter.toCityId);
    }

    const rows = await query.orderBy("listings.created_at", "desc").execute();
    return rows.map((row) => toEntity(row as ListingRow));
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

  async create(input: NewListing, executor: Executor = this.db): Promise<Listing> {
    const inserted = await executor
      .insertInto("listings")
      .values({
        owner_id: input.ownerId,
        type: input.type,
        from_city_id: input.fromCityId,
        to_city_id: input.toCityId,
        travel_date: input.date,
        free_weight_kg: input.freeWeightKg,
        price_per_kg: input.pricePerKg,
        min_price: input.minPrice,
        description: input.description,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const created = await this.findById(inserted.id, executor);
    if (!created) {
      throw new Error("Объявление не найдено сразу после создания");
    }
    return created;
  }
}
