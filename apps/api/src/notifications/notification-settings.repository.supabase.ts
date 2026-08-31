import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { INotificationSettingsRepository } from "./notification-settings.repository.js";
import type { NotificationSettings, UpdateNotificationSettings } from "./notifications.types.js";

function toDomain(row: {
  user_id: string;
  messages_push: boolean;
  messages_email: boolean;
  messages_telegram: boolean;
  listings_push: boolean;
  listings_email: boolean;
  listings_telegram: boolean;
  service_push: boolean;
  service_email: boolean;
  service_telegram: boolean;
}): NotificationSettings {
  return {
    userId: row.user_id,
    messagesPush: row.messages_push,
    messagesEmail: row.messages_email,
    messagesTelegram: row.messages_telegram,
    listingsPush: row.listings_push,
    listingsEmail: row.listings_email,
    listingsTelegram: row.listings_telegram,
    servicePush: row.service_push,
    serviceEmail: row.service_email,
    serviceTelegram: row.service_telegram,
  };
}

@Injectable()
export class SupabaseNotificationSettingsRepository implements INotificationSettingsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findOrCreate(userId: string): Promise<NotificationSettings> {
    const existing = await this.db
      .selectFrom("notification_settings")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (existing) return toDomain(existing);

    const row = await this.db
      .insertInto("notification_settings")
      .values({ user_id: userId })
      .onConflict((oc) => oc.column("user_id").doNothing())
      .returningAll()
      .executeTakeFirst();
    if (row) return toDomain(row);

    // Гонка: кто-то создал запись между SELECT и INSERT — просто читаем её.
    return toDomain(
      await this.db.selectFrom("notification_settings").selectAll().where("user_id", "=", userId).executeTakeFirstOrThrow(),
    );
  }

  async update(userId: string, input: UpdateNotificationSettings): Promise<NotificationSettings> {
    await this.findOrCreate(userId);

    const row = await this.db
      .updateTable("notification_settings")
      .set({
        ...(input.messagesPush !== undefined && { messages_push: input.messagesPush }),
        ...(input.messagesEmail !== undefined && { messages_email: input.messagesEmail }),
        ...(input.messagesTelegram !== undefined && { messages_telegram: input.messagesTelegram }),
        ...(input.listingsPush !== undefined && { listings_push: input.listingsPush }),
        ...(input.listingsEmail !== undefined && { listings_email: input.listingsEmail }),
        ...(input.listingsTelegram !== undefined && { listings_telegram: input.listingsTelegram }),
        ...(input.servicePush !== undefined && { service_push: input.servicePush }),
        ...(input.serviceEmail !== undefined && { service_email: input.serviceEmail }),
        ...(input.serviceTelegram !== undefined && { service_telegram: input.serviceTelegram }),
      })
      .where("user_id", "=", userId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }
}
