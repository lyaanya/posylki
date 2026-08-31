import type { NotificationChannel, NotificationSettings, NotificationSettingsGroup } from "./notifications.types.js";

/**
 * ТЗ п.14.8 — группу "сделки" отключить нельзя: её нет в
 * NotificationSettings вовсе (см. таблицу/типы), поэтому канал для неё
 * всегда включён независимо от настроек пользователя.
 */
export function isChannelEnabled(
  settings: NotificationSettings,
  group: NotificationSettingsGroup | "deals",
  channel: NotificationChannel,
): boolean {
  if (group === "deals") return true;
  const key = `${group}${channel[0]!.toUpperCase()}${channel.slice(1)}` as keyof NotificationSettings;
  return settings[key] as boolean;
}
