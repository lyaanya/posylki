import { randomUUID } from "node:crypto";
import { Body, Controller, Get, HttpStatus, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AppException } from "../common/app-exception.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
import { RegisterDeviceTokenDto } from "./dto/register-device-token.dto.js";
import { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto.js";
import { DEVICE_TOKENS_REPOSITORY, type IDeviceTokensRepository } from "./device-tokens.repository.js";
import {
  NOTIFICATION_SETTINGS_REPOSITORY,
  type INotificationSettingsRepository,
} from "./notification-settings.repository.js";
import { NOTIFICATIONS_REPOSITORY, type INotificationsRepository } from "./notifications.repository.js";
import { TELEGRAM_LINKS_REPOSITORY, type ITelegramLinksRepository } from "./telegram-links.repository.js";
import type { Notification, NotificationSettings, TelegramLink } from "./notifications.types.js";

const LIST_LIMIT = 50;

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

/** ТЗ E14 пп.14.7-14.9, 14.21 — список уведомлений, настройки, регистрация каналов. */
@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly notifications: INotificationsRepository,
    @Inject(NOTIFICATION_SETTINGS_REPOSITORY) private readonly settings: INotificationSettingsRepository,
    @Inject(DEVICE_TOKENS_REPOSITORY) private readonly deviceTokens: IDeviceTokensRepository,
    @Inject(TELEGRAM_LINKS_REPOSITORY) private readonly telegramLinks: ITelegramLinksRepository,
  ) {}

  @Get()
  async findMine(@CurrentUser() user?: AuthUser): Promise<Notification[]> {
    if (!user) throw authRequired();
    return this.notifications.findForUser(user.id, LIST_LIMIT);
  }

  @Get("unread-count")
  async unreadCount(@CurrentUser() user?: AuthUser): Promise<{ count: number }> {
    if (!user) throw authRequired();
    return { count: await this.notifications.countUnread(user.id) };
  }

  @Post(":id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user?: AuthUser): Promise<Notification> {
    if (!user) throw authRequired();
    const updated = await this.notifications.markRead(id, user.id);
    if (!updated) {
      throw new AppException({
        code: "NOTIFICATION_NOT_FOUND",
        message: "Уведомление не найдено",
        status: HttpStatus.NOT_FOUND,
      });
    }
    return updated;
  }

  @Get("settings")
  async getSettings(@CurrentUser() user?: AuthUser): Promise<NotificationSettings> {
    if (!user) throw authRequired();
    return this.settings.findOrCreate(user.id);
  }

  @Patch("settings")
  async updateSettings(
    @Body() dto: UpdateNotificationSettingsDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<NotificationSettings> {
    if (!user) throw authRequired();
    return this.settings.update(user.id, dto);
  }

  @Post("device-tokens")
  async registerDeviceToken(
    @Body() dto: RegisterDeviceTokenDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ ok: true }> {
    if (!user) throw authRequired();
    await this.deviceTokens.register(user.id, dto.platform, dto.token);
    return { ok: true };
  }

  /** ТЗ п.14.3 — одноразовый токен привязки; довершает бот, которого в этой итерации нет (см. отчёт эпика). */
  @Post("telegram-link")
  async createTelegramLink(@CurrentUser() user?: AuthUser): Promise<TelegramLink> {
    if (!user) throw authRequired();
    return this.telegramLinks.createOrReuseToken(user.id, randomUUID());
  }
}
