import { Module } from "@nestjs/common";
import { DirectoriesModule } from "../directories/directories.module.js";
import { ProfileModule } from "../profile/profile.module.js";
import { EmailChannel } from "./channels/email.channel.js";
import { PushChannel } from "./channels/push.channel.js";
import { TelegramChannel } from "./channels/telegram.channel.js";
import { DEVICE_TOKENS_REPOSITORY } from "./device-tokens.repository.js";
import { SupabaseDeviceTokensRepository } from "./device-tokens.repository.supabase.js";
import { NOTIFICATION_SETTINGS_REPOSITORY } from "./notification-settings.repository.js";
import { SupabaseNotificationSettingsRepository } from "./notification-settings.repository.supabase.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsDispatchCronService } from "./notifications-dispatch-cron.service.js";
import { NOTIFICATIONS_REPOSITORY } from "./notifications.repository.js";
import { SupabaseNotificationsRepository } from "./notifications.repository.supabase.js";
import { NotificationsService } from "./notifications.service.js";
import { TELEGRAM_LINKS_REPOSITORY } from "./telegram-links.repository.js";
import { SupabaseTelegramLinksRepository } from "./telegram-links.repository.supabase.js";

@Module({
  imports: [DirectoriesModule, ProfileModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsDispatchCronService,
    PushChannel,
    EmailChannel,
    TelegramChannel,
    { provide: NOTIFICATIONS_REPOSITORY, useClass: SupabaseNotificationsRepository },
    { provide: NOTIFICATION_SETTINGS_REPOSITORY, useClass: SupabaseNotificationSettingsRepository },
    { provide: DEVICE_TOKENS_REPOSITORY, useClass: SupabaseDeviceTokensRepository },
    { provide: TELEGRAM_LINKS_REPOSITORY, useClass: SupabaseTelegramLinksRepository },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
