import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.js";
import { USERS_REPOSITORY, type IUsersRepository } from "../../auth/users.repository.js";
import type { ChannelSendInput, ChannelSendResult, INotificationChannel } from "./notification-channel.js";

/**
 * ТЗ п.14.7 — транзакционная почта через Resend. Без RESEND_API_KEY канал
 * недоступен по объективной причине (нет аккаунта в сервисе). После
 * заведения ключа письма реально уходят через REST API Resend — но пока
 * для домена отправителя не настроены SPF/DKIM/DMARC, они с высокой
 * вероятностью попадут в спам; см. NOTIFICATIONS_EMAIL_FROM в env.ts и
 * отчёт эпика.
 */
@Injectable()
export class EmailChannel implements INotificationChannel {
  readonly name = "email" as const;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
  ) {}

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const apiKey = this.config.get("RESEND_API_KEY", { infer: true });
    const from = this.config.get("NOTIFICATIONS_EMAIL_FROM", { infer: true });
    if (!apiKey || !from) {
      return { ok: false, unavailable: true };
    }

    const user = await this.users.findById(input.userId);
    if (!user) {
      return { ok: true };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: user.email,
          subject: input.title,
          html: `<p>${escapeHtml(input.body)}</p><p><a href="${escapeHtml(input.deepLink)}">Открыть в приложении</a></p>`,
        }),
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        return { ok: false, unavailable: false, error: `Resend ${response.status}: ${details}` };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, unavailable: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
