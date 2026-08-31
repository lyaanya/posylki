import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ISubscriptionsRepository } from "./subscriptions.repository.js";
import type {
  ListingMatchCandidate,
  NewRouteSubscription,
  RouteSubscription,
} from "./subscriptions.types.js";

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

@Injectable()
export class SupabaseSubscriptionsRepository implements ISubscriptionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  private baseQuery(executor: Executor) {
    return executor
      .selectFrom("route_subscriptions")
      .innerJoin("cities as from_city", "from_city.id", "route_subscriptions.from_city_id")
      .innerJoin("cities as to_city", "to_city.id", "route_subscriptions.to_city_id")
      .select((eb) => [
        "route_subscriptions.id as id",
        "route_subscriptions.from_city_id as from_city_id",
        "from_city.name_ru as from_city_name",
        "route_subscriptions.to_city_id as to_city_id",
        "to_city.name_ru as to_city_name",
        "route_subscriptions.date_from as date_from",
        "route_subscriptions.date_to as date_to",
        "route_subscriptions.listing_type as listing_type",
        "route_subscriptions.is_active as is_active",
        "route_subscriptions.created_at as created_at",
        eb
          .selectFrom("subscription_matches")
          .select((inner) => inner.fn.countAll<string>().as("count"))
          .whereRef("subscription_matches.subscription_id", "=", "route_subscriptions.id")
          .as("match_count"),
      ]);
  }

  private toEntity(row: {
    id: string;
    from_city_id: string;
    from_city_name: string;
    to_city_id: string;
    to_city_name: string;
    date_from: Date | null;
    date_to: Date | null;
    listing_type: "trip" | "request" | null;
    is_active: boolean;
    created_at: Date;
    match_count: string | null;
  }): RouteSubscription {
    return {
      id: row.id,
      fromCityId: row.from_city_id,
      fromCity: row.from_city_name,
      toCityId: row.to_city_id,
      toCity: row.to_city_name,
      dateFrom: formatDate(row.date_from),
      dateTo: formatDate(row.date_to),
      listingType: row.listing_type,
      isActive: row.is_active,
      matchCount: Number(row.match_count ?? 0),
      createdAt: row.created_at,
    };
  }

  async findByUser(userId: string, executor: Executor = this.db): Promise<RouteSubscription[]> {
    const rows = await this.baseQuery(executor)
      .where("route_subscriptions.user_id", "=", userId)
      .orderBy("route_subscriptions.created_at", "desc")
      .execute();
    return rows.map((row) => this.toEntity(row));
  }

  async countByUser(userId: string, executor: Executor = this.db): Promise<number> {
    const result = await executor
      .selectFrom("route_subscriptions")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async create(input: NewRouteSubscription, executor: Executor = this.db): Promise<RouteSubscription> {
    const inserted = await executor
      .insertInto("route_subscriptions")
      .values({
        user_id: input.userId,
        from_city_id: input.fromCityId,
        to_city_id: input.toCityId,
        date_from: input.dateFrom,
        date_to: input.dateTo,
        listing_type: input.listingType,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const created = await this.baseQuery(executor)
      .where("route_subscriptions.id", "=", inserted.id)
      .executeTakeFirst();
    if (!created) {
      throw new Error("Подписка не найдена сразу после создания");
    }
    return this.toEntity(created);
  }

  async findOwned(
    id: string,
    userId: string,
    executor: Executor = this.db,
  ): Promise<RouteSubscription | null> {
    const row = await this.baseQuery(executor)
      .where("route_subscriptions.id", "=", id)
      .where("route_subscriptions.user_id", "=", userId)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async setActive(
    id: string,
    isActive: boolean,
    executor: Executor = this.db,
  ): Promise<RouteSubscription> {
    await executor
      .updateTable("route_subscriptions")
      .set({ is_active: isActive })
      .where("id", "=", id)
      .execute();
    const updated = await this.baseQuery(executor)
      .where("route_subscriptions.id", "=", id)
      .executeTakeFirst();
    if (!updated) {
      throw new Error("Подписка не найдена после обновления");
    }
    return this.toEntity(updated);
  }

  async delete(id: string, executor: Executor = this.db): Promise<void> {
    await executor.deleteFrom("route_subscriptions").where("id", "=", id).execute();
  }

  async recordMatches(
    listing: ListingMatchCandidate,
    executor: Executor = this.db,
  ): Promise<number> {
    const matching = await executor
      .selectFrom("route_subscriptions")
      .select("id")
      .where("is_active", "=", true)
      .where("from_city_id", "=", listing.fromCityId)
      .where("to_city_id", "=", listing.toCityId)
      .where((eb) => eb.or([eb("listing_type", "is", null), eb("listing_type", "=", listing.type)]))
      // Пересечение диапазонов: подписка "с/по" (если задана) должна
      // пересекаться с датами объявления, а не входить в них целиком.
      .where((eb) =>
        eb.or([eb("date_to", "is", null), eb("date_to", ">=", new Date(`${listing.dateFrom}T00:00:00Z`))]),
      )
      .where((eb) =>
        eb.or([eb("date_from", "is", null), eb("date_from", "<=", new Date(`${listing.dateTo}T00:00:00Z`))]),
      )
      .execute();

    if (matching.length === 0) {
      return 0;
    }

    await executor
      .insertInto("subscription_matches")
      .values(matching.map((row) => ({ subscription_id: row.id, listing_id: listing.id })))
      .onConflict((oc) => oc.columns(["subscription_id", "listing_id"]).doNothing())
      .execute();

    return matching.length;
  }
}
