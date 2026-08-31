import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ISupportTicketsRepository } from "./support-tickets.repository.js";
import type {
  NewSupportTicket,
  SupportTicket,
  SupportTicketContext,
  SupportTicketStatus,
} from "./support.types.js";

function toDomain(row: {
  id: string;
  user_id: string;
  chat_id: string;
  status: SupportTicketStatus;
  linked_object_type: SupportTicket["linkedObjectType"];
  linked_object_id: string | null;
  context: unknown;
  claimed_by: string | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
}): SupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    chatId: row.chat_id,
    status: row.status,
    linkedObjectType: row.linked_object_type,
    linkedObjectId: row.linked_object_id,
    context: row.context as SupportTicketContext,
    claimedBy: row.claimed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

@Injectable()
export class SupabaseSupportTicketsRepository implements ISupportTicketsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(entry: NewSupportTicket, executor: Executor = this.db): Promise<SupportTicket> {
    const row = await executor
      .insertInto("support_tickets")
      .values({
        user_id: entry.userId,
        chat_id: entry.chatId,
        linked_object_type: entry.linkedObjectType,
        linked_object_id: entry.linkedObjectId,
        context: JSON.stringify(entry.context),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findActiveForUser(userId: string): Promise<SupportTicket | null> {
    const row = await this.db
      .selectFrom("support_tickets")
      .selectAll()
      .where("user_id", "=", userId)
      .where("status", "<>", "closed")
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findLatestForUser(userId: string): Promise<SupportTicket | null> {
    const row = await this.db
      .selectFrom("support_tickets")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<SupportTicket | null> {
    const row = await this.db.selectFrom("support_tickets").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByChatId(chatId: string): Promise<SupportTicket | null> {
    const row = await this.db
      .selectFrom("support_tickets")
      .selectAll()
      .where("chat_id", "=", chatId)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findQueue(): Promise<SupportTicket[]> {
    const rows = await this.db
      .selectFrom("support_tickets")
      .selectAll()
      .where("status", "<>", "closed")
      .orderBy("created_at", "asc")
      .execute();
    return rows.map(toDomain);
  }

  async setStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | null> {
    const row = await this.db
      .updateTable("support_tickets")
      .set({ status, ...(status === "closed" ? { closed_at: new Date().toISOString() } : {}) })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async reopen(
    id: string,
    update?: { linkedObjectType: SupportTicket["linkedObjectType"]; linkedObjectId: string | null; context: SupportTicketContext },
  ): Promise<SupportTicket | null> {
    const row = await this.db
      .updateTable("support_tickets")
      .set({
        status: "awaiting_moderator",
        closed_at: null,
        claimed_by: null,
        ...(update
          ? {
              linked_object_type: update.linkedObjectType,
              linked_object_id: update.linkedObjectId,
              context: JSON.stringify(update.context),
            }
          : {}),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async claim(id: string, adminId: string): Promise<SupportTicket | null> {
    const row = await this.db
      .updateTable("support_tickets")
      .set({ claimed_by: adminId, status: "in_progress" })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }
}
