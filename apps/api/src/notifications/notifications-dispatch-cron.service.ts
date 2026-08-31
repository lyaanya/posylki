import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { isChannelEnabled } from "./channel-settings.js";
import { EmailChannel } from "./channels/email.channel.js";
import type { INotificationChannel } from "./channels/notification-channel.js";
import { PushChannel } from "./channels/push.channel.js";
import { TelegramChannel } from "./channels/telegram.channel.js";
import { EVENT_CONFIG } from "./notification-events.config.js";
import {
  NOTIFICATION_SETTINGS_REPOSITORY,
  type INotificationSettingsRepository,
} from "./notification-settings.repository.js";
import { NOTIFICATIONS_REPOSITORY, type INotificationsRepository } from "./notifications.repository.js";
import type { Notification } from "./notifications.types.js";
import { nextRetryDelayMs } from "./retry-backoff.js";

const BATCH_SIZE = 100;

/**
 * ТЗ п.14.2/14.17-14.18 — фоновая развёртка due-уведомлений (send_after
 * наступил, ещё не sent_at) в каналы. Раз в минуту, а не сразу в момент
 * создания: так тихие часы (14.10) и есть "отправить не раньше" полем и
 * фоновой задачей, а не задержкой в памяти процесса (см. тех. детали ТЗ).
 *
 * Сегодня все три канала возвращают unavailable (нет доступов — см. отчёт
 * эпика), поэтому фактически каждая запись сразу помечается sent
 * (обработана), не попадая в цикл повторов, — это и есть корректное
 * поведение для перманентно не настроенного канала, не баг.
 */
@Injectable()
export class NotificationsDispatchCronService {
  private readonly logger = new Logger(NotificationsDispatchCronService.name);
  private readonly channels: Record<string, INotificationChannel>;

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly notifications: INotificationsRepository,
    @Inject(NOTIFICATION_SETTINGS_REPOSITORY) private readonly settings: INotificationSettingsRepository,
    @Inject(PushChannel) push: PushChannel,
    @Inject(EmailChannel) email: EmailChannel,
    @Inject(TelegramChannel) telegram: TelegramChannel,
  ) {
    this.channels = { push, email, telegram };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    const due = await this.notifications.findDueToSend(new Date(), BATCH_SIZE);
    for (const notification of due) {
      await this.dispatch(notification);
    }
  }

  private async dispatch(notification: Notification): Promise<void> {
    const config = EVENT_CONFIG[notification.event];
    const settings = await this.settings.findOrCreate(notification.userId);

    let lastError: string | null = null;

    for (const channelName of config.channels) {
      if (!isChannelEnabled(settings, config.group, channelName)) continue;

      const channel = this.channels[channelName];
      if (!channel) continue;

      try {
        const result = await channel.send({
          userId: notification.userId,
          title: notification.title,
          body: notification.body,
          deepLink: notification.deepLink,
        });
        if (!result.ok && !result.unavailable) {
          lastError = result.error;
        }
      } catch (error) {
        lastError = String(error);
      }
    }

    if (lastError) {
      const delay = nextRetryDelayMs(notification.retryCount);
      const nextSendAfter = delay ? new Date(Date.now() + delay) : null;
      await this.notifications.markFailed(notification.id, lastError, nextSendAfter);
      if (!nextSendAfter) {
        this.logger.warn(`Уведомление ${notification.id} не доставлено после ${notification.retryCount + 1} попыток: ${lastError}`);
      }
      return;
    }

    await this.notifications.markSent(notification.id);
  }
}
