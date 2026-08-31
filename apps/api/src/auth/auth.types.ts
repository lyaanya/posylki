import type { ColumnType, Generated } from "kysely";

export type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected";

/** users (E01/E03) — профиль поверх auth.users, id совпадает с id Supabase Auth. */
export interface UsersTable {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  about_text: string | null;
  date_of_birth: ColumnType<Date | null, string | null, string | null>;
  document_type: string | null;
  document_number_hash: string | null;
  verification_status: VerificationStatus;
  /** ТЗ E04 — теперь есть настоящий писатель (verification/verification-requests.repository.supabase.ts approveVerification). */
  verified_at: ColumnType<Date | null, string | null, string | null>;
  verified_by_admin_id: string | null;
  referred_by_id: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  /** ТЗ E12 п.12.17 — теперь есть настоящий писатель (moderation/delete-account.ts). */
  deleted_at: ColumnType<Date | null, never, string>;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
  /** E06 п. 6.8 — город проживания, из справочника (E05). */
  city_id: string | null;
  /**
   * E06 п. 6.13-6.15 — денормализованные показатели репутации, пересчитываются
   * событийно при завершении сделки (E10) и публикации отзыва (E11). Ни один
   * из этих эпиков ещё не реализован, поэтому приложение сейчас эти колонки
   * только читает (всегда пусто/ноль) и никогда не пишет.
   */
  courier_rating: ColumnType<number | null, never, never>;
  courier_deals_count: ColumnType<number, never, never>;
  customer_rating: ColumnType<number | null, never, never>;
  customer_deals_count: ColumnType<number, never, never>;
  frequent_routes: ColumnType<string[], never, never>;
}

/**
 * Подмножество служебной таблицы Supabase Auth (не наша миграция, схему не
 * контролируем) — только то, что реально нужно бизнес-логике: узнать,
 * подтверждён ли email (ТЗ E09 п.9.17 — писать в чат можно только с
 * подтверждённой почтой).
 */
export interface AuthUsersTable {
  id: string;
  email_confirmed_at: ColumnType<Date | null, never, never>;
}

export type LegalDocumentType = "terms" | "privacy" | "service_rules" | "consent";

/** legal_documents (E03 п. 3.13) — версионированные юридические документы. */
export interface LegalDocumentsTable {
  id: Generated<string>;
  type: LegalDocumentType;
  version: number;
  title: string;
  body_markdown: string;
  effective_at: ColumnType<Date, string | undefined, never>;
  created_at: ColumnType<Date, never, never>;
}

export type LegalConsentMethod = "registration" | "reacceptance";

/** legal_consents (E03 п. 3.14) — факт принятия конкретной версии документа. */
export interface LegalConsentsTable {
  id: Generated<string>;
  user_id: string;
  legal_document_id: string;
  accepted_at: ColumnType<Date, string | undefined, never>;
  method: LegalConsentMethod;
}

/** user_sessions (E03 п. 3.9) — журнал активных сессий для экрана «Сессии». */
export interface UserSessionsTable {
  id: Generated<string>;
  user_id: string;
  supabase_session_id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  last_seen_at: ColumnType<Date, string | undefined, string>;
  revoked_at: ColumnType<Date | null, string | null | undefined, string | null>;
}

export interface LegalDocument {
  id: string;
  type: LegalDocumentType;
  version: number;
  title: string;
  bodyMarkdown: string;
  effectiveAt: Date;
  createdAt: Date;
}

export interface LegalConsent {
  id: string;
  userId: string;
  legalDocumentId: string;
  acceptedAt: Date;
  method: LegalConsentMethod;
}

export interface NewLegalConsent {
  userId: string;
  legalDocumentId: string;
  method: LegalConsentMethod;
}

export interface UserSession {
  id: string;
  userId: string;
  supabaseSessionId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

export interface NewUserSession {
  userId: string;
  supabaseSessionId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}
