import type { ColumnType, Generated } from "kysely";

export type ReviewRole = "as_courier" | "as_customer";

export interface ReviewsTable {
  id: Generated<string>;
  deal_id: string;
  author_id: string;
  subject_id: string;
  role: ReviewRole;
  rating: number | null;
  text: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  published_at: ColumnType<Date | null, string | null, string | null>;
  moderated_at: ColumnType<Date | null, string | null, string | null>;
  moderated_by: string | null;
  moderation_reason: string | null;
}

export interface ReviewAuthor {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  /** ТЗ п.11.20 — отзывы удалённых пользователей сохраняются, автор показывается обезличенно. */
  isDeleted: boolean;
}

export interface Review {
  id: string;
  dealId: string;
  author: ReviewAuthor;
  subjectId: string;
  role: ReviewRole;
  rating: number | null;
  text: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  /** Маршрут сделки — ТЗ п.11.19 показывает его в карточке отзыва. */
  fromCity: string;
  toCity: string;
}

export interface NewReview {
  dealId: string;
  authorId: string;
  subjectId: string;
  role: ReviewRole;
  rating: number;
  text: string | null;
}
