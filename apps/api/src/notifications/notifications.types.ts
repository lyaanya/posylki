import type { ColumnType, Generated } from "kysely";

/**
 * Список короче полного перечня ТЗ 14.5: verification_result ждёt E04,
 * support_reply — E15, subscription_match отложен (нужна отдельная
 * почасовая группировка и notified_at — 14.15). См. миграцию.
 */
export type NotificationEvent =
  | "chat_message"
  | "deal_created"
  | "deal_status_changed"
  | "deal_overweight_reconfirm"
  | "storage_extension_requested"
  | "storage_extension_decided"
  | "storage_reminder"
  | "review_published"
  | "review_reminder"
  | "complaint_decided"
  | "moderator_warning"
  | "support_reply"
  | "support_ticket_alert"
  | "verification_result";

/** Три из четырёх групп ТЗ 14.7 — группу "сделки" отключить нельзя (14.8), поэтому переключателей для неё в настройках нет. */
export type NotificationSettingsGroup = "messages" | "listings" | "service";
export type NotificationChannel = "push" | "email" | "telegram";

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  event: NotificationEvent;
  title: string;
  body: string;
  deep_link: string;
  payload: unknown;
  is_urgent: boolean;
  send_after: ColumnType<Date, string | undefined, string>;
  sent_at: ColumnType<Date | null, string | null, string | null>;
  read_at: ColumnType<Date | null, string | null, string | null>;
  retry_count: Generated<number>;
  error_message: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface NotificationSettingsTable {
  user_id: string;
  messages_push: Generated<boolean>;
  messages_email: Generated<boolean>;
  messages_telegram: Generated<boolean>;
  listings_push: Generated<boolean>;
  listings_email: Generated<boolean>;
  listings_telegram: Generated<boolean>;
  service_push: Generated<boolean>;
  service_email: Generated<boolean>;
  service_telegram: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface DeviceTokensTable {
  id: Generated<string>;
  user_id: string;
  platform: "ios" | "android";
  token: string;
  created_at: ColumnType<Date, string | undefined, never>;
  last_seen_at: ColumnType<Date, string | undefined, string>;
}

export interface TelegramLinksTable {
  id: Generated<string>;
  user_id: string;
  link_token: string;
  telegram_chat_id: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  linked_at: ColumnType<Date | null, string | null, string | null>;
}

// === Доменные типы ===========================================================

export interface Notification {
  id: string;
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  deepLink: string;
  payload: Record<string, unknown>;
  isUrgent: boolean;
  sendAfter: Date;
  sentAt: Date | null;
  readAt: Date | null;
  retryCount: number;
  errorMessage: string | null;
  createdAt: Date;
}

export interface NewNotification {
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  deepLink: string;
  payload?: Record<string, unknown>;
  isUrgent: boolean;
  sendAfter: Date;
}

export interface NotificationSettings {
  userId: string;
  messagesPush: boolean;
  messagesEmail: boolean;
  messagesTelegram: boolean;
  listingsPush: boolean;
  listingsEmail: boolean;
  listingsTelegram: boolean;
  servicePush: boolean;
  serviceEmail: boolean;
  serviceTelegram: boolean;
}

export type UpdateNotificationSettings = Partial<Omit<NotificationSettings, "userId">>;

export interface DeviceToken {
  id: string;
  userId: string;
  platform: "ios" | "android";
  token: string;
}

export interface TelegramLink {
  id: string;
  userId: string;
  linkToken: string;
  telegramChatId: string | null;
  linkedAt: Date | null;
}
