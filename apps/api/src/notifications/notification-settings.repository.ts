import type { NotificationSettings, UpdateNotificationSettings } from "./notifications.types.js";

export interface INotificationSettingsRepository {
  /** Создаёт запись по умолчанию (всё включено), если её ещё нет — вызывается лениво при первом обращении. */
  findOrCreate(userId: string): Promise<NotificationSettings>;
  update(userId: string, input: UpdateNotificationSettings): Promise<NotificationSettings>;
}

export const NOTIFICATION_SETTINGS_REPOSITORY = Symbol("NOTIFICATION_SETTINGS_REPOSITORY");
