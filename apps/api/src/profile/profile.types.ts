import type { VerificationStatus } from "../auth/auth.types.js";

export interface PublicProfile {
  id: string;
  /**
   * ТЗ E06 п.6.9 берёт имя из проверенного документа (E04). E04 в этой
   * итерации сознательно не реализован (то же решение, что и для гейта
   * верификации при публикации объявлений — см. listings.controller.ts),
   * поэтому здесь временно null, пока пользователь не задал имя вручную
   * через updateOwnProfile.
   */
  displayName: string | null;
  avatarUrl: string | null;
  aboutText: string | null;
  city: string | null;
  verificationStatus: VerificationStatus;
  /** ТЗ E11 п.11.11-11.12 — null, пока нет ни одного опубликованного отзыва ("пока нет оценок", не 0). */
  courierRating: number | null;
  courierDealsCount: number;
  /** Число оценок, из которых считался courierRating — 0, если courierRating тоже null. */
  courierRatingCount: number;
  customerRating: number | null;
  customerDealsCount: number;
  customerRatingCount: number;
  /** До E10 (сделки) всегда пустой массив. */
  frequentRoutes: string[];
  createdAt: Date;
  /** ТЗ E08 п.8.20 — сколько людей зарегистрировалось по ссылке этого пользователя. */
  referredCount: number;
}

export type PublicProfileView =
  | ({ status: "active" } & PublicProfile)
  | { status: "blocked"; id: string }
  | { status: "deleted"; id: string };

export interface OwnProfile extends PublicProfile {
  email: string;
  phone: string | null;
  cityId: string | null;
  /** null — ещё не пришёл по чьей-то реферальной ссылке (ТЗ п.8.17). */
  referredById: string | null;
}

export interface UpdateOwnProfileInput {
  displayName?: string | null;
  aboutText?: string | null;
  cityId?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}
