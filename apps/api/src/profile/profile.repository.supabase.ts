import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Updateable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { UsersTable, VerificationStatus } from "../auth/auth.types.js";
import type { IProfileRepository } from "./profile.repository.js";
import type { OwnProfile, PublicProfile, PublicProfileView, UpdateOwnProfileInput } from "./profile.types.js";

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  about_text: string | null;
  city_id: string | null;
  city_name: string | null;
  verification_status: VerificationStatus;
  courier_rating: number | null;
  courier_deals_count: number;
  courier_rating_count: string | null;
  customer_rating: number | null;
  customer_deals_count: number;
  customer_rating_count: string | null;
  frequent_routes: string[];
  created_at: Date;
  is_blocked: boolean;
  deleted_at: Date | null;
  email: string;
  phone: string | null;
  referred_by_id: string | null;
  referred_count: string | null;
}

/**
 * ТЗ E06 п.6.9 хранит имя как first_name/last_name из проверенного документа.
 * Пока E04 не реализован (см. profile.types.ts), displayName редактируется
 * пользователем одним полем — здесь он раскладывается в те же две колонки,
 * чтобы карточки объявлений (listings.repository.supabase.ts, courierName)
 * подхватывали то же самое имя без отдельного пути данных.
 */
function splitDisplayName(displayName: string | null): {
  first_name: string | null;
  last_name: string | null;
} {
  const trimmed = displayName?.trim() ?? "";
  if (!trimmed) {
    return { first_name: null, last_name: null };
  }
  const [first, ...rest] = trimmed.split(/\s+/);
  return { first_name: first ?? null, last_name: rest.length > 0 ? rest.join(" ") : null };
}

function toDisplayName(row: Pick<ProfileRow, "first_name" | "last_name">): string | null {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}

function toPublicProfile(row: ProfileRow): PublicProfile {
  return {
    id: row.id,
    displayName: toDisplayName(row),
    avatarUrl: row.avatar_url,
    aboutText: row.about_text,
    city: row.city_name,
    verificationStatus: row.verification_status,
    courierRating: row.courier_rating,
    courierDealsCount: row.courier_deals_count,
    courierRatingCount: Number(row.courier_rating_count ?? 0),
    customerRating: row.customer_rating,
    customerDealsCount: row.customer_deals_count,
    customerRatingCount: Number(row.customer_rating_count ?? 0),
    frequentRoutes: row.frequent_routes,
    createdAt: row.created_at,
    referredCount: Number(row.referred_count ?? 0),
  };
}

@Injectable()
export class SupabaseProfileRepository implements IProfileRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  private baseQuery(executor: Executor) {
    return executor
      .selectFrom("users")
      .leftJoin("cities", "cities.id", "users.city_id")
      .select((eb) => [
        "users.id as id",
        "users.first_name as first_name",
        "users.last_name as last_name",
        "users.avatar_url as avatar_url",
        "users.about_text as about_text",
        "users.city_id as city_id",
        "cities.name_ru as city_name",
        "users.verification_status as verification_status",
        "users.courier_rating as courier_rating",
        "users.courier_deals_count as courier_deals_count",
        "users.customer_rating as customer_rating",
        "users.customer_deals_count as customer_deals_count",
        "users.frequent_routes as frequent_routes",
        "users.created_at as created_at",
        "users.is_blocked as is_blocked",
        "users.deleted_at as deleted_at",
        "users.email as email",
        "users.phone as phone",
        "users.referred_by_id as referred_by_id",
        eb
          .selectFrom("users as referred")
          .select((inner) => inner.fn.countAll<string>().as("count"))
          .whereRef("referred.referred_by_id", "=", "users.id")
          .as("referred_count"),
        // ТЗ E11 п.11.11 — рейтинг сам денормализован в users, но число
        // оценок считаем на чтении, а не отдельным счётчиком: оно нужно
        // только для отображения ("4.7 · 12 оценок"), заводить для него
        // ещё одну колонку, которую придётся держать в синхроне, незачем.
        eb
          .selectFrom("reviews as courier_reviews")
          .select((inner) => inner.fn.countAll<string>().as("count"))
          .whereRef("courier_reviews.subject_id", "=", "users.id")
          .where("courier_reviews.role", "=", "as_courier")
          .where("courier_reviews.published_at", "is not", null)
          .as("courier_rating_count"),
        eb
          .selectFrom("reviews as customer_reviews")
          .select((inner) => inner.fn.countAll<string>().as("count"))
          .whereRef("customer_reviews.subject_id", "=", "users.id")
          .where("customer_reviews.role", "=", "as_customer")
          .where("customer_reviews.published_at", "is not", null)
          .as("customer_rating_count"),
      ]);
  }

  async findPublicProfile(
    id: string,
    executor: Executor = this.db,
  ): Promise<PublicProfileView | null> {
    const row = (await this.baseQuery(executor)
      .where("users.id", "=", id)
      .executeTakeFirst()) as ProfileRow | undefined;

    if (!row) {
      return null;
    }
    // Удалённый аккаунт обезличивается независимо от блокировки (E06 п. 6.7);
    // блокировка проверяется только для ещё не удалённых (E06 п. 6.6).
    if (row.deleted_at) {
      return { status: "deleted", id: row.id };
    }
    if (row.is_blocked) {
      return { status: "blocked", id: row.id };
    }
    return { status: "active", ...toPublicProfile(row) };
  }

  async findOwnProfile(id: string, executor: Executor = this.db): Promise<OwnProfile | null> {
    const row = (await this.baseQuery(executor)
      .where("users.id", "=", id)
      .executeTakeFirst()) as ProfileRow | undefined;

    if (!row) {
      return null;
    }
    return {
      ...toPublicProfile(row),
      email: row.email,
      phone: row.phone,
      cityId: row.city_id,
      referredById: row.referred_by_id,
    };
  }

  /**
   * ТЗ п.8.17 — записывается один раз: если реферер уже задан, повторный
   * переход по чужой ссылке ничего не меняет (не позволяет "переприсвоить"
   * пригласившего задним числом).
   */
  async setReferrer(
    id: string,
    referrerId: string,
    executor: Executor = this.db,
  ): Promise<OwnProfile> {
    await executor
      .updateTable("users")
      .set({ referred_by_id: referrerId })
      .where("id", "=", id)
      .where("referred_by_id", "is", null)
      .execute();

    const updated = await this.findOwnProfile(id, executor);
    if (!updated) {
      throw new Error("Профиль не найден после записи реферера");
    }
    return updated;
  }

  async incrementDealsCount(
    id: string,
    role: "courier" | "customer",
    executor: Executor = this.db,
  ): Promise<void> {
    const column = role === "courier" ? "courier_deals_count" : "customer_deals_count";
    await executor
      .updateTable("users")
      .set((eb) => ({ [column]: eb(column, "+", 1) }))
      .where("id", "=", id)
      .execute();
  }

  async updateOwnProfile(
    id: string,
    input: UpdateOwnProfileInput,
    executor: Executor = this.db,
  ): Promise<OwnProfile> {
    const updates: Updateable<UsersTable> = {};

    if (input.displayName !== undefined) {
      Object.assign(updates, splitDisplayName(input.displayName));
    }
    if (input.aboutText !== undefined) {
      updates.about_text = input.aboutText;
    }
    if (input.cityId !== undefined) {
      updates.city_id = input.cityId;
    }
    if (input.phone !== undefined) {
      updates.phone = input.phone;
    }
    if (input.avatarUrl !== undefined) {
      updates.avatar_url = input.avatarUrl;
    }

    if (Object.keys(updates).length > 0) {
      await executor.updateTable("users").set(updates).where("id", "=", id).execute();
    }

    const updated = await this.findOwnProfile(id, executor);
    if (!updated) {
      throw new Error("Профиль не найден сразу после обновления");
    }
    return updated;
  }
}
