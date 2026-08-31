import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { INotificationsRepository } from "./notifications.repository.js";
import type { NewNotification, Notification } from "./notifications.types.js";

function toDomain(row: {
  id: string;
  user_id: string;
  event: Notification["event"];
  title: string;
  body: string;
  deep_link: string;
  payload: unknown;
  is_urgent: boolean;
  send_after: Date;
  sent_at: Date | null;
  read_at: Date | null;
  retry_count: number;
  error_message: string | null;
  created_at: Date;
}): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    event: row.event,
    title: row.title,
    body: row.body,
    deepLink: row.deep_link,
    payload: (row.payload as Record<string, unknown> | null) ?? {},
    isUrgent: row.is_urgent,
    sendAfter: row.send_after,
    sentAt: row.sent_at,
    readAt: row.read_at,
    retryCount: row.retry_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

@Injectable()
export class SupabaseNotificationsRepository implements INotificationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(entry: NewNotification, executor: Executor = this.db): Promise<Notification> {
    const row = await executor
      .insertInto("notifications")
      .values({
        user_id: entry.userId,
        event: entry.event,
        title: entry.title,
        body: entry.body,
        deep_link: entry.deepLink,
        payload: JSON.stringify(entry.payload ?? {}),
        is_urgent: entry.isUrgent,
        send_after: entry.sendAfter.toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findForUser(userId: string, limit: number): Promise<Notification[]> {
    const rows = await this.db
      .selectFrom("notifications")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute();
    return rows.map(toDomain);
  }

  async countUnread(userId: string): Promise<number> {
    const row = await this.db
      .selectFrom("notifications")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    // UPDATE с `where read_at is null` не находит строку, если уже
    // прочитана — тогда просто отдаём текущее состояние, а не ошибку.
    await this.db
      .updateTable("notifications")
      .set({ read_at: new Date().toISOString() })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .execute();

    const row = await this.db
      .selectFrom("notifications")
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findDueToSend(now: Date, limit: number): Promise<Notification[]> {
    const rows = await this.db
      .selectFrom("notifications")
      .selectAll()
      .where("sent_at", "is", null)
      .where("send_after", "<=", now)
      .orderBy("send_after", "asc")
      .limit(limit)
      .execute();
    return rows.map(toDomain);
  }

  async markSent(id: string): Promise<void> {
    await this.db.updateTable("notifications").set({ sent_at: new Date().toISOString(), error_message: null }).where("id", "=", id).execute();
  }

  async markFailed(id: string, errorMessage: string, nextSendAfter: Date | null): Promise<void> {
    await this.db
      .updateTable("notifications")
      .set((eb) => ({
        retry_count: eb("retry_count", "+", 1),
        error_message: errorMessage,
        ...(nextSendAfter ? { send_after: nextSendAfter.toISOString() } : { sent_at: new Date().toISOString() }),
      }))
      .where("id", "=", id)
      .execute();
  }

  async findGroupableChatNotification(userId: string, chatId: string): Promise<Notification | null> {
    const row = await this.db
      .selectFrom("notifications")
      .selectAll()
      .where("user_id", "=", userId)
      .where("event", "=", "chat_message")
      .where("read_at", "is", null)
      .where(sql<string>`payload ->> 'chatId'`, "=", chatId)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  /** Счётчик группировки (14.14) считает NotificationsService — репозиторий только перезаписывает текст и payload существующей строки. */
  async updateGrouped(id: string, title: string, body: string, payload: Record<string, unknown>): Promise<void> {
    await this.db
      .updateTable("notifications")
      .set({ title, body, payload: JSON.stringify(payload) })
      .where("id", "=", id)
      .execute();
  }
}
