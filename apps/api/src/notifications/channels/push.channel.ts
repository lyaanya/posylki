import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.js";
import { DEVICE_TOKENS_REPOSITORY, type IDeviceTokensRepository } from "../device-tokens.repository.js";
import type { ChannelSendInput, ChannelSendResult, INotificationChannel } from "./notification-channel.js";

/**
 * ТЗ пп.14.5-14.6, 14.19 (задачи 14.5-14.6) — APNs/FCM. Нет ни сертификата
 * Apple Developer, ни проекта Firebase (оба требуют доступов вне
 * возможностей агента — см. отчёт эпика), поэтому реализация честно
 * сообщает unavailable вместо фиктивной отправки. Регистрация токенов
 * (register/findForUser) настоящая и рабочая уже сейчас — когда доступы
 * появятся, менять нужно будет только тело send().
 */
@Injectable()
export class PushChannel implements INotificationChannel {
  readonly name = "push" as const;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(DEVICE_TOKENS_REPOSITORY) private readonly deviceTokens: IDeviceTokensRepository,
  ) {}

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const apnsKey = this.config.get("APNS_KEY", { infer: true });
    const fcmKey = this.config.get("FCM_SERVER_KEY", { infer: true });
    if (!apnsKey && !fcmKey) {
      return { ok: false, unavailable: true };
    }

    const tokens = await this.deviceTokens.findForUser(input.userId);
    if (tokens.length === 0) {
      // Нет зарегистрированных устройств — это не сбой, отправлять некуда.
      return { ok: true };
    }

    // Место для реального вызова APNs/FCM SDK — недостижимо без ключей выше.
    return { ok: false, unavailable: true };
  }
}
