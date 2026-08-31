import type { ColumnType, Generated } from "kysely";

/**
 * Без with_assistant/new — ассистент (сценарии 15.7-15.14) отложен как
 * nice-to-have (15.14, "тогда обращения сразу уходят к человеку"); см.
 * миграцию support.sql и отчёт эпика. Добавление ассистента не потребует
 * миграции существующих строк — только новое значение в этом union и
 * в CHECK на стороне БД.
 */
export type SupportTicketStatus = "awaiting_moderator" | "in_progress" | "closed";
export type SupportLinkedObjectType = "deal" | "listing" | "verification";

/** ТЗ п.15.4 — контекст, собранный автоматически при создании обращения, виден только модератору. */
export interface SupportTicketContext {
  verificationStatus: string;
  totalDealsCount: number;
  activeDealIds: string[];
  activeListingIds: string[];
  platform: string | null;
  appVersion: string | null;
  lastError: string | null;
}

export interface SupportTicketsTable {
  id: Generated<string>;
  user_id: string;
  chat_id: string;
  status: Generated<SupportTicketStatus>;
  linked_object_type: SupportLinkedObjectType | null;
  linked_object_id: string | null;
  context: unknown;
  claimed_by: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
  closed_at: ColumnType<Date | null, string | null, string | null>;
}

export interface SupportFaqTable {
  id: Generated<string>;
  question: string;
  answer: string;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

// === Доменные типы ===========================================================

export interface SupportTicket {
  id: string;
  userId: string;
  chatId: string;
  status: SupportTicketStatus;
  linkedObjectType: SupportLinkedObjectType | null;
  linkedObjectId: string | null;
  context: SupportTicketContext;
  claimedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface NewSupportTicket {
  userId: string;
  chatId: string;
  linkedObjectType: SupportLinkedObjectType | null;
  linkedObjectId: string | null;
  context: SupportTicketContext;
}

export interface SupportFaqEntry {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
}

export interface NewSupportFaqEntry {
  question: string;
  answer: string;
}

export interface UpdateSupportFaqEntry {
  question?: string;
  answer?: string;
  isActive?: boolean;
}

/** Фиксированный аккаунт "Поддержка" — вторая сторона любого чата поддержки (см. миграцию support.sql). */
export const SUPPORT_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";
