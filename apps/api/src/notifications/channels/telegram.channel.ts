import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.js";
import { TELEGRAM_LINKS_REPOSITORY, type ITelegramLinksRepository } from "../telegram-links.repository.js";
import type { ChannelSendInput, ChannelSendResult, INotificationChannel } from "./notification-channel.js";

/**
 * ТЗ п.14.8 — Telegram Bot API. Нет токена бота (nice-to-have, режется
 * первым по ТЗ п.14.4), поэтому канал недоступен. Привязка (14.3) —
 * генерация одноразового токена — реализована в TelegramLinksRepository и
 * работает уже сейчас; довершить может только сам бот, которого нет.
 */
@Injectable()
export class TelegramChannel implements INotificationChannel {
  readonly name = "telegram" as const;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(TELEGRAM_LINKS_REPOSITORY) private readonly links: ITelegramLinksRepository,
  ) {}

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const botToken = this.config.get("TELEGRAM_BOT_TOKEN", { infer: true });
    if (!botToken) {
      return { ok: false, unavailable: true };
    }

    const link = await this.links.findByUserId(input.userId);
    if (!link?.telegramChatId) {
      return { ok: true };
    }

    // Место для реального вызова Bot API — недостижимо без токена выше.
    return { ok: false, unavailable: true };
  }
}
