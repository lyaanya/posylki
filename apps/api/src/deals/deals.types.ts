import type { ColumnType, Generated } from "kysely";

export type DealStatus =
  | "responded"
  | "agreed"
  | "handed_over"
  | "in_transit"
  | "awaiting_pickup"
  | "delivered"
  | "completed"
  | "cancelled"
  | "problem";

export const TERMINAL_DEAL_STATUSES: DealStatus[] = ["completed", "cancelled", "problem"];

export type DealCancelReason =
  | "changed_mind"
  | "terms_not_agreed"
  | "schedule_changed"
  | "found_another"
  | "other";

export type ContactEvent = "handover" | "pickup";
export type ContactRole = "customer" | "courier";
export type ConsentType = "stop_list" | "item_warning";
export type StorageExtensionStatus = "pending" | "approved" | "rejected";

// === Таблицы Kysely (snake_case, как в БД) ==================================

export interface DealsTable {
  id: Generated<string>;
  chat_id: string;
  listing_id: string;
  customer_id: string;
  courier_id: string;
  deal_type: Generated<"delivery">;
  status: Generated<DealStatus>;
  declared_weight_grams: number | null;
  actual_weight_grams: number | null;
  reserved_weight_grams: number | null;
  price_minor: number | null;
  currency_id: string;
  storage_until_date: ColumnType<Date | null, string | null, string | null>;
  customer_agreed_at: ColumnType<Date | null, string | null, string | null>;
  courier_agreed_at: ColumnType<Date | null, string | null, string | null>;
  courier_handed_over_at: ColumnType<Date | null, string | null, string | null>;
  customer_handed_over_confirmed_at: ColumnType<Date | null, string | null, string | null>;
  cancel_reason: string | null;
  cancel_comment: string | null;
  needs_review: ColumnType<boolean, boolean | undefined, boolean>;
  reminder_3d_sent: ColumnType<boolean, boolean | undefined, boolean>;
  reminder_1d_sent: ColumnType<boolean, boolean | undefined, boolean>;
  reminder_expiry_sent: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface DealItemsTable {
  id: Generated<string>;
  deal_id: string;
  name: string;
  quantity: Generated<number>;
  weight_grams: number | null;
  warning_text: string | null;
  ai_check_failed: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface DealPhotosTable {
  id: Generated<string>;
  deal_id: string;
  storage_path: string;
  uploaded_by: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface DealContactsTable {
  id: Generated<string>;
  deal_id: string;
  event: ContactEvent;
  role: ContactRole;
  name: string;
  phone: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface DealStatusLogTable {
  id: Generated<string>;
  deal_id: string;
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  comment: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface DealConsentsTable {
  id: Generated<string>;
  deal_id: string;
  user_id: string;
  consent_type: ConsentType;
  stop_list_version: ColumnType<Date | null, string | null, never>;
  consented_at: ColumnType<Date, string | undefined, never>;
}

export interface StorageExtensionRequestsTable {
  id: Generated<string>;
  deal_id: string;
  requested_by: string;
  requested_until_date: ColumnType<Date, string, string>;
  status: Generated<StorageExtensionStatus>;
  decided_by: string | null;
  decided_at: ColumnType<Date | null, string | null, string | null>;
  created_at: ColumnType<Date, string | undefined, never>;
}

// === Доменные типы (camelCase) ==============================================

export interface DealParticipant {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export interface DealItem {
  id: string;
  name: string;
  quantity: number;
  weightGrams: number | null;
  warningText: string | null;
  aiCheckFailed: boolean;
  createdAt: Date;
}

export interface DealPhoto {
  id: string;
  url: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface DealContact {
  event: ContactEvent;
  role: ContactRole;
  name: string;
  phone: string;
}

export interface DealStatusLogEntry {
  id: string;
  fromStatus: DealStatus | null;
  toStatus: DealStatus;
  actorId: string | null;
  comment: string | null;
  createdAt: Date;
}

export interface DealConsent {
  userId: string;
  consentType: ConsentType;
  consentedAt: Date;
}

export interface StorageExtensionRequest {
  id: string;
  requestedBy: string;
  requestedUntilDate: string;
  status: StorageExtensionStatus;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export interface Deal {
  id: string;
  chatId: string;
  listingId: string;
  dealType: "delivery";
  status: DealStatus;
  customer: DealParticipant;
  courier: DealParticipant;
  fromCityId: string;
  fromCity: string;
  toCityId: string;
  toCity: string;
  dateFrom: string;
  dateTo: string;
  declaredWeightGrams: number | null;
  actualWeightGrams: number | null;
  /** greatest(заявленный, фактический) — ТЗ п.10.15. null, пока заявленный не внесён. */
  payableWeightGrams: number | null;
  /** Сколько веса реально удержано из листинга — для точного возврата при отмене/облегчении. */
  reservedWeightGrams: number | null;
  priceMinor: number | null;
  currencyCode: string;
  currencySymbol: string;
  storageUntilDate: string | null;
  customerAgreedAt: Date | null;
  courierAgreedAt: Date | null;
  courierHandedOverAt: Date | null;
  customerHandedOverConfirmedAt: Date | null;
  cancelReason: DealCancelReason | null;
  cancelComment: string | null;
  needsReview: boolean;
  items: DealItem[];
  photos: DealPhoto[];
  contacts: DealContact[];
  consents: DealConsent[];
  storageExtensionRequests: StorageExtensionRequest[];
  statusLog: DealStatusLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NewDeal {
  chatId: string;
  listingId: string;
  customerId: string;
  courierId: string;
  currencyId: string;
  /** Кто откликнулся и начал сделку (ТЗ п.10.1) — заказчик на рейс либо курьер на заявку. */
  createdBy: string;
}

export interface NewDealItem {
  name: string;
  quantity: number;
  weightGrams: number | null;
  warningText: string | null;
  aiCheckFailed: boolean;
}
