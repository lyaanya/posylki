import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.js";
import type { ChannelSendInput, ChannelSendResult, INotificationChannel } from "./notification-channel.js";

/**
 * ТЗ п.14.7 — транзакционная почта (Resend/Postmark). Нет ни аккаунта в
 * сервисе, ни настроенных SPF/DKIM/DMARC для домена (без них письма ушли
 * бы в спам, и канал был бы бесполезен даже с рабочим ключом — см. отчёт
 * эпика), поэтому канал сегодня недоступен по объективной причине, а не
 * забыт.
 */
@Injectable()
export class EmailChannel implements INotificationChannel {
  readonly name = "email" as const;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {}

  async send(_input: ChannelSendInput): Promise<ChannelSendResult> {
    const apiKey = this.config.get("RESEND_API_KEY", { infer: true });
    if (!apiKey) {
      return { ok: false, unavailable: true };
    }
    // Место для реального вызова Resend/Postmark — недостижимо без ключа выше.
    return { ok: false, unavailable: true };
  }
}
