import type { NotificationChannel, NotificationEvent, NotificationSettingsGroup } from "./notifications.types.js";

/**
 * Таблица ТЗ 14.5 в коде: для каждого события — каналы по умолчанию,
 * срочность (обходит тихие часы, 14.12) и группа настроек (14.7), которой
 * оно принадлежит. "Сделки" — не пользовательская настройка (14.8), но
 * группа всё равно нужна здесь, чтобы дальше не City ветвить по событию.
 */
export interface EventConfig {
  channels: NotificationChannel[];
  isUrgent: boolean;
  group: NotificationSettingsGroup | "deals";
}

export const EVENT_CONFIG: Record<NotificationEvent, EventConfig> = {
  chat_message: { channels: ["push", "telegram"], isUrgent: true, group: "messages" },
  deal_created: { channels: ["push", "email", "telegram"], isUrgent: true, group: "deals" },
  deal_status_changed: { channels: ["push", "email", "telegram"], isUrgent: true, group: "deals" },
  deal_overweight_reconfirm: { channels: ["push", "email", "telegram"], isUrgent: true, group: "deals" },
  storage_extension_requested: { channels: ["push", "email", "telegram"], isUrgent: true, group: "deals" },
  storage_extension_decided: { channels: ["push", "email", "telegram"], isUrgent: true, group: "deals" },
  storage_reminder: { channels: ["push", "email", "telegram"], isUrgent: true, group: "deals" },
  review_published: { channels: ["push", "telegram"], isUrgent: false, group: "service" },
  review_reminder: { channels: ["push", "telegram"], isUrgent: false, group: "service" },
  complaint_decided: { channels: ["push", "email", "telegram"], isUrgent: false, group: "service" },
  moderator_warning: { channels: ["push", "email", "telegram"], isUrgent: true, group: "service" },
  support_reply: { channels: ["push", "email", "telegram"], isUrgent: true, group: "service" },
  /** ТЗ E15 п.15.17 — модератору, а не автору обращения; см. support.service.ts notifyModerators(). */
  support_ticket_alert: { channels: ["telegram", "push"], isUrgent: true, group: "service" },
  verification_result: { channels: ["push", "email", "telegram"], isUrgent: true, group: "service" },
};
