import { Kysely, PostgresDialect, type Transaction } from "kysely";
import { Pool } from "pg";
import type { AuditLogTable } from "../audit-log/audit-log.types.js";
import type {
  AuthUsersTable,
  LegalConsentsTable,
  LegalDocumentsTable,
  UserSessionsTable,
  UsersTable,
} from "../auth/auth.types.js";
import type {
  ChatReadStateTable,
  ChatsTable,
  MessageAttachmentsTable,
  MessagesTable,
  UserBlocksTable,
} from "../chat/chat.types.js";
import type {
  CitiesTable,
  CurrenciesTable,
  DocumentTypesTable,
  StopListItemsTable,
  WeightReferencesTable,
} from "../directories/directories.types.js";
import type { AdminSessionsTable, AdminUsersTable } from "../admin/admin.types.js";
import type { AiRequestsTable, ModerationResultsTable } from "../ai/ai.types.js";
import type {
  DealConsentsTable,
  DealContactsTable,
  DealItemsTable,
  DealPhotosTable,
  DealStatusLogTable,
  DealsTable,
  StorageExtensionRequestsTable,
} from "../deals/deals.types.js";
import type { ListingsTable } from "../listings/listings.types.js";
import type {
  ComplaintsTable,
  ModerationDecisionsTable,
  UserBansTable,
  UserWarningsTable,
} from "../moderation/moderation.types.js";
import type {
  DeviceTokensTable,
  NotificationSettingsTable,
  NotificationsTable,
  TelegramLinksTable,
} from "../notifications/notifications.types.js";
import type { ReviewsTable } from "../reviews/reviews.types.js";
import type { RouteSubscriptionsTable, SubscriptionMatchesTable } from "../subscriptions/subscriptions.types.js";
import type { SupportFaqTable, SupportTicketsTable } from "../support/support.types.js";
import type { VerificationRequestsTable } from "../verification/verification.types.js";

/**
 * Схема базы, дополняется по мере появления таблиц в каждом эпике —
 * каждая новая таблица добавляется сюда как поле: `<table>: <Table>Table`.
 */
export interface DB {
  audit_log: AuditLogTable;
  users: UsersTable;
  legal_documents: LegalDocumentsTable;
  legal_consents: LegalConsentsTable;
  user_sessions: UserSessionsTable;
  cities: CitiesTable;
  currencies: CurrenciesTable;
  weight_references: WeightReferencesTable;
  stop_list_items: StopListItemsTable;
  document_types: DocumentTypesTable;
  admin_users: AdminUsersTable;
  admin_sessions: AdminSessionsTable;
  ai_requests: AiRequestsTable;
  moderation_results: ModerationResultsTable;
  listings: ListingsTable;
  route_subscriptions: RouteSubscriptionsTable;
  subscription_matches: SubscriptionMatchesTable;
  chats: ChatsTable;
  messages: MessagesTable;
  message_attachments: MessageAttachmentsTable;
  chat_read_state: ChatReadStateTable;
  user_blocks: UserBlocksTable;
  deals: DealsTable;
  deal_items: DealItemsTable;
  deal_photos: DealPhotosTable;
  deal_contacts: DealContactsTable;
  deal_status_log: DealStatusLogTable;
  deal_consents: DealConsentsTable;
  storage_extension_requests: StorageExtensionRequestsTable;
  reviews: ReviewsTable;
  complaints: ComplaintsTable;
  moderation_decisions: ModerationDecisionsTable;
  user_warnings: UserWarningsTable;
  user_bans: UserBansTable;
  notifications: NotificationsTable;
  notification_settings: NotificationSettingsTable;
  device_tokens: DeviceTokensTable;
  telegram_links: TelegramLinksTable;
  support_tickets: SupportTicketsTable;
  support_faq: SupportFaqTable;
  verification_requests: VerificationRequestsTable;
  /** Служебная таблица Supabase Auth, не наша миграция — см. auth.types.ts. */
  "auth.users": AuthUsersTable;
}

/**
 * Executor — общий тип для "обычного" подключения и для транзакции.
 * Методы репозиториев принимают Executor вместо конкретно Kysely<DB>,
 * чтобы один и тот же метод одинаково работал и вне транзакции,
 * и будучи вызванным внутри чужой транзакции (см. runInTransaction).
 */
export type Executor = Kysely<DB> | Transaction<DB>;

export function createDatabase(connectionString: string): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
  });
}

/**
 * Единая точка входа для многотабличных атомарных операций (E01 п. 1.16).
 * Внутри fn все репозитории вызываются с переданным trx, чтобы попасть
 * в одну транзакцию: либо применяется всё, либо не применяется ничего.
 */
export function runInTransaction<T>(
  db: Kysely<DB>,
  fn: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(fn);
}
