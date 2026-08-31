import type { Executor } from "../database/database.js";
import type { NewNotification, Notification } from "./notifications.types.js";

export interface INotificationsRepository {
  create(entry: NewNotification, executor?: Executor): Promise<Notification>;
  findForUser(userId: string, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<Notification | null>;
  /** ТЗ п.14.17/14.20 — сообщения, которым пора уйти в каналы (send_after наступил, ещё не отправлены). */
  findDueToSend(now: Date, limit: number): Promise<Notification[]>;
  markSent(id: string): Promise<void>;
  /**
   * ТЗ п.14.18 — увеличивает retry_count и записывает причину сбоя.
   * nextSendAfter — когда повторить (нарастающий интервал); null — попытки
   * исчерпаны, уведомление помечается отправленным с сохранённой ошибкой
   * (недоставленное, но не зависает в очереди навсегда).
   */
  markFailed(id: string, errorMessage: string, nextSendAfter: Date | null): Promise<void>;
  /**
   * ТЗ п.14.14 — группировка подряд идущих сообщений одного чата: если для
   * этого получателя уже есть непрочитанное chat_message-уведомление по
   * этому же чату, увеличиваем счётчик в payload вместо новой записи.
   */
  findGroupableChatNotification(userId: string, chatId: string): Promise<Notification | null>;
  updateGrouped(id: string, title: string, body: string, payload: Record<string, unknown>): Promise<void>;
}

export const NOTIFICATIONS_REPOSITORY = Symbol("NOTIFICATIONS_REPOSITORY");
