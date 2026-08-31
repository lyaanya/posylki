import { Inject, Injectable, Logger } from "@nestjs/common";
import { CITIES_REPOSITORY, type ICitiesRepository } from "../directories/cities.repository.js";
import { PROFILE_REPOSITORY, type IProfileRepository } from "../profile/profile.repository.js";
import { notificationCopy, type NotificationCopy } from "./notification-copy.js";
import { EVENT_CONFIG } from "./notification-events.config.js";
import { NOTIFICATIONS_REPOSITORY, type INotificationsRepository } from "./notifications.repository.js";
import { computeSendAfter, resolveTimezone } from "./quiet-hours.js";
import type { NotificationEvent } from "./notifications.types.js";

export interface NotifyInput {
  userId: string;
  event: NotificationEvent;
  /** Не нужен для "chat_message" — текст (в т.ч. счётчик группировки, 14.14) считает сам сервис. */
  copy?: NotificationCopy;
  payload?: Record<string, unknown>;
}

/**
 * Единая точка входа для создания уведомлений (E14 п.14.2) — тот же
 * принцип, что у AiService (E13) и ModerationActionsService (E12): один
 * сервис, вызывающий код не знает про тихие часы, часовые пояса или
 * группировку. Сам вызов create() создаёт "ин-апп" запись (14.21) сразу;
 * отправка во внешние каналы асинхронна и происходит отдельным
 * NotificationsDispatchCronService — падение push/email/telegram никогда
 * не затрагивает этот метод (14.17), потому что до внешних каналов он
 * вообще не доходит.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly notifications: INotificationsRepository,
    @Inject(PROFILE_REPOSITORY) private readonly profiles: IProfileRepository,
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    try {
      if (input.event === "chat_message") {
        await this.notifyChatMessage(input);
        return;
      }

      if (!input.copy) {
        this.logger.error(`notify(${input.event}) вызван без copy — пропускаю`);
        return;
      }

      await this.createNotification(input.userId, input.event, input.copy, input.payload ?? {});
    } catch (error) {
      // ТЗ п.14.17 — сбой уведомления никогда не должен ломать основной сценарий.
      this.logger.error(`Не удалось создать уведомление (${input.event}): ${String(error)}`);
    }
  }

  /**
   * Проверка "чат открыт" (14.16) сделана до вызова notify() — на стороне
   * ChatController, у которого уже есть доступ к ChatRepository; здесь
   * его не запрашиваем намеренно, чтобы NotificationsModule не зависел от
   * ChatModule, а тот в свою очередь — от NotificationsModule (иначе
   * циклический импорт модулей).
   */
  private async notifyChatMessage(input: NotifyInput): Promise<void> {
    const chatId = input.payload?.["chatId"];
    const senderName = input.payload?.["senderName"];
    if (typeof chatId !== "string" || typeof senderName !== "string") {
      this.logger.error("notify(chat_message) требует payload.chatId и payload.senderName");
      return;
    }

    // ТЗ п.14.14 — несколько сообщений одного чата подряд дают одно уведомление со счётчиком.
    const existing = await this.notifications.findGroupableChatNotification(input.userId, chatId);
    if (existing) {
      const previousCount = typeof existing.payload["count"] === "number" ? existing.payload["count"] : 1;
      const count = previousCount + 1;
      const copy = notificationCopy.chatMessage(senderName, chatId, count);
      await this.notifications.updateGrouped(existing.id, copy.title, copy.body, { ...existing.payload, count });
      return;
    }

    const copy = notificationCopy.chatMessage(senderName, chatId, 1);
    await this.createNotification(input.userId, "chat_message", copy, { chatId, count: 1 });
  }

  private async createNotification(
    userId: string,
    event: NotificationEvent,
    copy: NotificationCopy,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const config = EVENT_CONFIG[event];
    const profile = await this.profiles.findOwnProfile(userId);
    const city = profile?.cityId ? await this.cities.findById(profile.cityId) : null;
    const timezone = resolveTimezone(city?.timezone);
    const sendAfter = computeSendAfter(new Date(), timezone, config.isUrgent);

    await this.notifications.create({
      userId,
      event,
      title: copy.title,
      body: copy.body,
      deepLink: copy.deepLink,
      payload,
      isUrgent: config.isUrgent,
      sendAfter,
    });
  }
}
