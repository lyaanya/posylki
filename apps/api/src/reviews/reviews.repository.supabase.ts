import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { buildPaginatedResponse, type PaginatedResponse } from "../common/pagination.js";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IReviewsRepository } from "./reviews.repository.js";
import type { NewReview, Review, ReviewRole } from "./reviews.types.js";

interface ReviewRow {
  id: string;
  deal_id: string;
  subject_id: string;
  role: ReviewRole;
  rating: number | null;
  text: string | null;
  created_at: Date;
  published_at: Date | null;
  from_city_name: string;
  to_city_name: string;
  author_id: string;
  author_first_name: string | null;
  author_last_name: string | null;
  author_email: string;
  author_avatar_url: string | null;
  author_deleted_at: Date | null;
}

function authorName(row: ReviewRow): string {
  if (row.author_deleted_at) return "Удалённый пользователь";
  const fullName = [row.author_first_name, row.author_last_name].filter(Boolean).join(" ").trim();
  if (fullName.length > 0) return fullName;
  return row.author_email.split("@")[0] ?? "Пользователь";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function toEntity(row: ReviewRow): Review {
  const isDeleted = row.author_deleted_at !== null;
  const name = authorName(row);
  return {
    id: row.id,
    dealId: row.deal_id,
    author: {
      id: row.author_id,
      name,
      initials: initialsOf(name),
      avatarUrl: isDeleted ? null : row.author_avatar_url,
      isDeleted,
    },
    subjectId: row.subject_id,
    role: row.role,
    rating: row.rating,
    text: row.text,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    fromCity: row.from_city_name,
    toCity: row.to_city_name,
  };
}

@Injectable()
export class SupabaseReviewsRepository implements IReviewsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  private baseQuery(executor: Executor) {
    return executor
      .selectFrom("reviews")
      .innerJoin("deals", "deals.id", "reviews.deal_id")
      .innerJoin("listings", "listings.id", "deals.listing_id")
      .innerJoin("cities as from_city", "from_city.id", "listings.from_city_id")
      .innerJoin("cities as to_city", "to_city.id", "listings.to_city_id")
      .innerJoin("users as author", "author.id", "reviews.author_id")
      .select([
        "reviews.id as id",
        "reviews.deal_id as deal_id",
        "reviews.subject_id as subject_id",
        "reviews.role as role",
        "reviews.rating as rating",
        "reviews.text as text",
        "reviews.created_at as created_at",
        "reviews.published_at as published_at",
        "from_city.name_ru as from_city_name",
        "to_city.name_ru as to_city_name",
        "author.id as author_id",
        "author.first_name as author_first_name",
        "author.last_name as author_last_name",
        "author.email as author_email",
        "author.avatar_url as author_avatar_url",
        "author.deleted_at as author_deleted_at",
      ]);
  }

  async create(input: NewReview, executor: Executor = this.db): Promise<Review> {
    const inserted = await executor
      .insertInto("reviews")
      .values({
        deal_id: input.dealId,
        author_id: input.authorId,
        subject_id: input.subjectId,
        role: input.role,
        rating: input.rating,
        text: input.text,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const created = await this.findById(inserted.id, executor);
    if (!created) throw new Error("Отзыв не найден сразу после создания");
    return created;
  }

  async findById(id: string, executor: Executor = this.db): Promise<Review | null> {
    const row = (await this.baseQuery(executor).where("reviews.id", "=", id).executeTakeFirst()) as
      | ReviewRow
      | undefined;
    return row ? toEntity(row) : null;
  }

  async findByDealAndAuthor(
    dealId: string,
    authorId: string,
    executor: Executor = this.db,
  ): Promise<Review | null> {
    const row = (await this.baseQuery(executor)
      .where("reviews.deal_id", "=", dealId)
      .where("reviews.author_id", "=", authorId)
      .executeTakeFirst()) as ReviewRow | undefined;
    return row ? toEntity(row) : null;
  }

  async findByDeal(dealId: string, executor: Executor = this.db): Promise<Review[]> {
    const rows = (await this.baseQuery(executor)
      .where("reviews.deal_id", "=", dealId)
      .execute()) as ReviewRow[];
    return rows.map(toEntity);
  }

  async publishForDeal(dealId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .updateTable("reviews")
      .set({ published_at: new Date().toISOString() })
      .where("deal_id", "=", dealId)
      .where("published_at", "is", null)
      .execute();
  }

  async publishSingle(reviewId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .updateTable("reviews")
      .set({ published_at: new Date().toISOString() })
      .where("id", "=", reviewId)
      .where("published_at", "is", null)
      .execute();
  }

  async findUnpublishedCreatedBefore(cutoff: Date, executor: Executor = this.db): Promise<Review[]> {
    const rows = (await this.baseQuery(executor)
      .where("reviews.published_at", "is", null)
      .where("reviews.created_at", "<", cutoff)
      .execute()) as ReviewRow[];
    return rows.map(toEntity);
  }

  async findPublishedForUser(
    userId: string,
    options: { limit: number; cursor?: { sortValue: string; id: string } | undefined },
    executor: Executor = this.db,
  ): Promise<PaginatedResponse<Review>> {
    let query = this.baseQuery(executor)
      .where("reviews.subject_id", "=", userId)
      .where("reviews.published_at", "is not", null);

    if (options.cursor) {
      const cursorDate = new Date(options.cursor.sortValue);
      const cursorId = options.cursor.id;
      query = query.where((eb) =>
        eb.or([
          eb("reviews.created_at", "<", cursorDate),
          eb.and([eb("reviews.created_at", "=", cursorDate), eb("reviews.id", "<", cursorId)]),
        ]),
      );
    }

    const rows = (await query
      .orderBy("reviews.created_at", "desc")
      .orderBy("reviews.id", "desc")
      .limit(options.limit + 1)
      .execute()) as ReviewRow[];

    const hasMore = rows.length > options.limit;
    const pageRows = hasMore ? rows.slice(0, options.limit) : rows;
    const items = pageRows.map(toEntity);

    let nextCursorPayload: Record<string, unknown> | null = null;
    if (hasMore) {
      const last = pageRows[pageRows.length - 1]!;
      nextCursorPayload = { sortValue: last.created_at.toISOString(), id: last.id };
    }

    return buildPaginatedResponse(items, nextCursorPayload);
  }

  async recomputeRating(
    subjectId: string,
    role: ReviewRole,
    executor: Executor = this.db,
  ): Promise<void> {
    const result = await executor
      .selectFrom("reviews")
      .select((eb) => eb.fn.avg<string | null>("rating").as("avg"))
      .where("subject_id", "=", subjectId)
      .where("role", "=", role)
      .where("published_at", "is not", null)
      .where("rating", "is not", null)
      .executeTakeFirst();

    // Один знак после запятой (ТЗ п.11.11) — округляем при сохранении, а не на отображении.
    const avg = result?.avg !== null && result?.avg !== undefined ? Math.round(Number(result.avg) * 10) / 10 : null;
    const column = role === "as_courier" ? "courier_rating" : "customer_rating";

    await executor
      .updateTable("users")
      .set({ [column]: avg })
      .where("id", "=", subjectId)
      .execute();
  }

  async moderateDelete(
    id: string,
    adminId: string,
    reason: string,
    executor: Executor = this.db,
  ): Promise<Review | null> {
    await executor
      .updateTable("reviews")
      .set({
        rating: null,
        text: null,
        moderated_at: new Date().toISOString(),
        moderated_by: adminId,
        moderation_reason: reason,
      })
      .where("id", "=", id)
      .execute();
    return this.findById(id, executor);
  }
}
