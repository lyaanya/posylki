import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ITelegramLinksRepository } from "./telegram-links.repository.js";
import type { TelegramLink } from "./notifications.types.js";

function toDomain(row: {
  id: string;
  user_id: string;
  link_token: string;
  telegram_chat_id: string | null;
  linked_at: Date | null;
}): TelegramLink {
  return {
    id: row.id,
    userId: row.user_id,
    linkToken: row.link_token,
    telegramChatId: row.telegram_chat_id,
    linkedAt: row.linked_at,
  };
}

@Injectable()
export class SupabaseTelegramLinksRepository implements ITelegramLinksRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async createOrReuseToken(userId: string, linkToken: string): Promise<TelegramLink> {
    const existing = await this.db
      .selectFrom("telegram_links")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();

    // Уже привязан — возвращаем как есть, новый токен не нужен.
    if (existing?.linked_at) return toDomain(existing);

    if (existing) {
      const updated = await this.db
        .updateTable("telegram_links")
        .set({ link_token: linkToken })
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirstOrThrow();
      return toDomain(updated);
    }

    const row = await this.db
      .insertInto("telegram_links")
      .values({ user_id: userId, link_token: linkToken })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findByUserId(userId: string): Promise<TelegramLink | null> {
    const row = await this.db.selectFrom("telegram_links").selectAll().where("user_id", "=", userId).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async completeLink(linkToken: string, telegramChatId: string): Promise<TelegramLink | null> {
    const row = await this.db
      .updateTable("telegram_links")
      .set({ telegram_chat_id: telegramChatId, linked_at: new Date().toISOString() })
      .where("link_token", "=", linkToken)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }
}
