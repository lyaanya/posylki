import type { PaginatedResponse } from "../common/pagination.js";
import type { Executor } from "../database/database.js";
import type { NewReview, Review, ReviewRole } from "./reviews.types.js";

export interface IReviewsRepository {
  create(input: NewReview, executor?: Executor): Promise<Review>;
  findById(id: string, executor?: Executor): Promise<Review | null>;
  findByDealAndAuthor(dealId: string, authorId: string, executor?: Executor): Promise<Review | null>;
  /** Обе стороны сделки, независимо от публикации — для проверки условия "обе написали" (ТЗ п.11.5). */
  findByDeal(dealId: string, executor?: Executor): Promise<Review[]>;
  /** Публикует все ещё неопубликованные отзывы этой сделки одним моментом (ТЗ п.11.5, первое условие). */
  publishForDeal(dealId: string, executor?: Executor): Promise<void>;
  /** Одиночная публикация по истечении 7 дней (ТЗ п.11.5, второе условие). */
  publishSingle(reviewId: string, executor?: Executor): Promise<void>;
  findUnpublishedCreatedBefore(cutoff: Date, executor?: Executor): Promise<Review[]>;
  findPublishedForUser(
    userId: string,
    options: { limit: number; cursor?: { sortValue: string; id: string } | undefined },
    executor?: Executor,
  ): Promise<PaginatedResponse<Review>>;
  /** Пересчитывает и сохраняет рейтинг в users денормализованно (ТЗ п.11.11/11.13). */
  recomputeRating(subjectId: string, role: ReviewRole, executor?: Executor): Promise<void>;
  /** ТЗ п.11.15 — обнуляет rating и text, оставляя строку (не даёт написать заново). */
  moderateDelete(
    id: string,
    adminId: string,
    reason: string,
    executor?: Executor,
  ): Promise<Review | null>;
}

export const REVIEWS_REPOSITORY = Symbol("REVIEWS_REPOSITORY");
