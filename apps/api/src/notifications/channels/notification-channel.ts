import type { NotificationChannel } from "../notifications.types.js";

export interface ChannelSendInput {
  userId: string;
  title: string;
  body: string;
  deepLink: string;
}

export type ChannelSendResult =
  | { ok: true }
  /** unavailable — канал не настроен (нет ключа/сертификата): не в счёт повторов (14.18), просто пропускается. */
  | { ok: false; unavailable: true }
  | { ok: false; unavailable: false; error: string };

/**
 * Общий контракт трёх каналов доставки (14.1). Ни у одного из них сегодня
 * нет реальных доступов (APNs/FCM/почтовый провайдер/Telegram Bot API) —
 * см. отчёт эпика. Реализации ниже честно возвращают unavailable вместо
 * притворной отправки, чтобы NotificationsDispatchService вёл себя
 * одинаково и сейчас, и когда доступы появятся.
 */
export interface INotificationChannel {
  readonly name: NotificationChannel;
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
}
