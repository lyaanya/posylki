import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { buildPaginatedResponse, type PaginatedResponse } from "../common/pagination.js";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import { CHAT_ATTACHMENT_STORAGE, type IChatAttachmentStorage } from "./chat-attachment-storage.js";
import type { ChatRef, IChatRepository } from "./chat.repository.js";
import type { ChatParticipant, ChatSummary, Message, MessageKind, NewMessage } from "./chat.types.js";

function courierName(row: {
  first_name: string | null;
  last_name: string | null;
  email: string;
}): string {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  if (fullName.length > 0) return fullName;
  return row.email.split("@")[0] ?? "Пользователь";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string | null;
  created_at: Date;
}

@Injectable()
export class SupabaseChatRepository implements IChatRepository {
  constructor(
    @Inject(DATABASE) private readonly db: Kysely<DB>,
    @Inject(CHAT_ATTACHMENT_STORAGE) private readonly attachmentStorage: IChatAttachmentStorage,
  ) {}

  async findOrCreateChatByListing(
    listingId: string,
    listingOwnerId: string,
    otherUserId: string,
    executor: Executor = this.db,
  ): Promise<ChatRef> {
    const existing = await executor
      .selectFrom("chats")
      .select(["id", "listing_id", "owner_id", "other_user_id"])
      .where("listing_id", "=", listingId)
      .where("other_user_id", "=", otherUserId)
      .executeTakeFirst();

    if (existing) {
      return {
        id: existing.id,
        listingId: existing.listing_id,
        ownerId: existing.owner_id,
        otherUserId: existing.other_user_id,
      };
    }

    const inserted = await executor
      .insertInto("chats")
      .values({ listing_id: listingId, owner_id: listingOwnerId, other_user_id: otherUserId })
      // Гонка двух одновременных первых сообщений на один чат (п.9.1) —
      // возвращаем уже существующую строку вместо ошибки уникальности.
      .onConflict((oc) => oc.columns(["listing_id", "other_user_id"]).doUpdateSet({ listing_id: listingId }))
      .returning(["id", "listing_id", "owner_id", "other_user_id"])
      .executeTakeFirstOrThrow();

    return {
      id: inserted.id,
      listingId: inserted.listing_id,
      ownerId: inserted.owner_id,
      otherUserId: inserted.other_user_id,
    };
  }

  async findOrCreateSupportChat(
    userId: string,
    supportAccountId: string,
    executor: Executor = this.db,
  ): Promise<ChatRef> {
    const existing = await executor
      .selectFrom("chats")
      .select(["id", "listing_id", "owner_id", "other_user_id"])
      .where("owner_id", "=", userId)
      .where("other_user_id", "=", supportAccountId)
      .where("kind", "=", "support")
      .executeTakeFirst();

    if (existing) {
      return {
        id: existing.id,
        listingId: existing.listing_id,
        ownerId: existing.owner_id,
        otherUserId: existing.other_user_id,
      };
    }

    const inserted = await executor
      .insertInto("chats")
      .values({ listing_id: null, owner_id: userId, other_user_id: supportAccountId, kind: "support" })
      .returning(["id", "listing_id", "owner_id", "other_user_id"])
      .executeTakeFirstOrThrow();

    return {
      id: inserted.id,
      listingId: inserted.listing_id,
      ownerId: inserted.owner_id,
      otherUserId: inserted.other_user_id,
    };
  }

  async findChatById(chatId: string, executor: Executor = this.db): Promise<ChatRef | null> {
    const row = await executor
      .selectFrom("chats")
      .select(["id", "listing_id", "owner_id", "other_user_id"])
      .where("id", "=", chatId)
      .executeTakeFirst();
    if (!row) return null;
    return { id: row.id, listingId: row.listing_id, ownerId: row.owner_id, otherUserId: row.other_user_id };
  }

  async findMessageById(messageId: string, executor: Executor = this.db): Promise<Message | null> {
    const row = (await executor
      .selectFrom("messages")
      .selectAll()
      .where("id", "=", messageId)
      .executeTakeFirst()) as MessageRow | undefined;
    if (!row) return null;

    const attachmentRows = await executor
      .selectFrom("message_attachments")
      .selectAll()
      .where("message_id", "=", row.id)
      .execute();
    const attachmentUrls = await Promise.all(
      attachmentRows.map((a) => this.attachmentStorage.createSignedUrl(a.storage_path)),
    );

    return {
      id: row.id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      kind: row.kind,
      body: row.body,
      attachmentUrls,
      createdAt: row.created_at,
    };
  }

  async listChatsForUser(userId: string, executor: Executor = this.db): Promise<ChatSummary[]> {
    const chatRows = await executor
      .selectFrom("chats")
      .leftJoin("chat_read_state", (join) =>
        join.onRef("chat_read_state.chat_id", "=", "chats.id").on("chat_read_state.user_id", "=", userId),
      )
      .select((eb) => [
        "chats.id as id",
        "chats.listing_id as listing_id",
        "chats.owner_id as owner_id",
        "chats.other_user_id as other_user_id",
        "chats.updated_at as updated_at",
        "chat_read_state.last_read_at as last_read_at",
        eb
          .selectFrom("messages")
          .select("id")
          .whereRef("messages.chat_id", "=", "chats.id")
          .orderBy("messages.created_at", "desc")
          .limit(1)
          .as("last_message_id"),
      ])
      .where((eb) => eb.or([eb("chats.owner_id", "=", userId), eb("chats.other_user_id", "=", userId)]))
      // ТЗ E15 — обращения в поддержку живут в своём разделе (/support), не в общем списке переписок.
      .where("chats.kind", "=", "user")
      .orderBy("chats.updated_at", "desc")
      .execute();

    if (chatRows.length === 0) return [];

    const chatIds = chatRows.map((r) => r.id);
    const lastMessageIds = chatRows.map((r) => r.last_message_id).filter((id): id is string => id !== null);
    const counterpartIds = chatRows.map((r) => (r.owner_id === userId ? r.other_user_id : r.owner_id));

    const [lastMessages, unreadRows, participants, blockedRows] = await Promise.all([
      lastMessageIds.length > 0
        ? executor.selectFrom("messages").selectAll().where("id", "in", lastMessageIds).execute()
        : Promise.resolve([]),
      executor
        .selectFrom("messages")
        .leftJoin("chat_read_state", (join) =>
          join
            .onRef("chat_read_state.chat_id", "=", "messages.chat_id")
            .on("chat_read_state.user_id", "=", userId),
        )
        .select((eb) => ["messages.chat_id as chat_id", eb.fn.countAll<string>().as("count")])
        .where("messages.chat_id", "in", chatIds)
        .where((eb) => eb.or([eb("messages.sender_id", "!=", userId), eb("messages.sender_id", "is", null)]))
        .where((eb) =>
          eb.or([
            eb("chat_read_state.last_read_at", "is", null),
            eb("messages.created_at", ">", eb.ref("chat_read_state.last_read_at")),
          ]),
        )
        .groupBy("messages.chat_id")
        .execute(),
      executor
        .selectFrom("users")
        .select(["id", "first_name", "last_name", "email", "avatar_url", "verification_status"])
        .where("id", "in", counterpartIds.length > 0 ? counterpartIds : [""])
        .execute(),
      executor
        .selectFrom("user_blocks")
        .select(["blocked_id"])
        .where("blocker_id", "=", userId)
        .where("blocked_id", "in", counterpartIds.length > 0 ? counterpartIds : [""])
        .execute(),
    ]);

    const lastMessageById = new Map(lastMessages.map((m) => [m.id, m as MessageRow]));
    const unreadByChatId = new Map(unreadRows.map((r) => [r.chat_id, Number(r.count)]));
    const participantById = new Map(participants.map((p) => [p.id, p]));
    const blockedSet = new Set(blockedRows.map((r) => r.blocked_id));

    return chatRows.map((row) => {
      const counterpartId = row.owner_id === userId ? row.other_user_id : row.owner_id;
      const participantRow = participantById.get(counterpartId);
      const name = participantRow ? courierName(participantRow) : "Пользователь";
      const counterpart: ChatParticipant = {
        id: counterpartId,
        name,
        initials: initialsOf(name),
        avatarUrl: participantRow?.avatar_url ?? null,
        verified: participantRow?.verification_status === "approved",
        rating: 0,
      };

      const lastRow = row.last_message_id ? lastMessageById.get(row.last_message_id) : undefined;
      const lastMessage: Message | null = lastRow
        ? {
            id: lastRow.id,
            chatId: lastRow.chat_id,
            senderId: lastRow.sender_id,
            kind: lastRow.kind,
            body: lastRow.body,
            // Превью в списке чатов не тянет подписанные ссылки на фото —
            // только сам тред (listMessages) их реально показывает.
            attachmentUrls: [],
            createdAt: lastRow.created_at,
          }
        : null;

      return {
        id: row.id,
        // Гарантированно не null: запрос выше отфильтрован по kind = 'user'.
        listingId: row.listing_id!,
        counterpart,
        lastMessage,
        unreadCount: unreadByChatId.get(row.id) ?? 0,
        isBlockedByMe: blockedSet.has(counterpartId),
        updatedAt: row.updated_at,
      };
    });
  }

  async listMessages(
    chatId: string,
    options: { limit: number; cursor?: { sortValue: string; id: string } | undefined },
    executor: Executor = this.db,
  ): Promise<PaginatedResponse<Message>> {
    let query = executor.selectFrom("messages").selectAll().where("chat_id", "=", chatId);

    if (options.cursor) {
      const cursorDate = new Date(options.cursor.sortValue);
      const cursorId = options.cursor.id;
      // Лента сообщений листается от новых к старым (следующая "страница"
      // — то, что старше уже показанного), в отличие от ленты объявлений.
      query = query.where((eb) =>
        eb.or([
          eb("created_at", "<", cursorDate),
          eb.and([eb("created_at", "=", cursorDate), eb("id", "<", cursorId)]),
        ]),
      );
    }

    const rows = (await query
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(options.limit + 1)
      .execute()) as MessageRow[];

    const hasMore = rows.length > options.limit;
    const pageRows = hasMore ? rows.slice(0, options.limit) : rows;

    const attachmentRows =
      pageRows.length > 0
        ? await executor
            .selectFrom("message_attachments")
            .selectAll()
            .where(
              "message_id",
              "in",
              pageRows.map((r) => r.id),
            )
            .execute()
        : [];

    const attachmentsByMessage = new Map<string, string[]>();
    for (const attachment of attachmentRows) {
      const list = attachmentsByMessage.get(attachment.message_id) ?? [];
      list.push(attachment.storage_path);
      attachmentsByMessage.set(attachment.message_id, list);
    }

    const items = await Promise.all(
      pageRows.map(async (row) => {
        const paths = attachmentsByMessage.get(row.id) ?? [];
        const attachmentUrls = await Promise.all(
          paths.map((path) => this.attachmentStorage.createSignedUrl(path)),
        );
        return {
          id: row.id,
          chatId: row.chat_id,
          senderId: row.sender_id,
          kind: row.kind,
          body: row.body,
          attachmentUrls,
          createdAt: row.created_at,
        } satisfies Message;
      }),
    );

    let nextCursorPayload: Record<string, unknown> | null = null;
    if (hasMore) {
      const last = pageRows[pageRows.length - 1]!;
      nextCursorPayload = { sortValue: last.created_at.toISOString(), id: last.id };
    }

    return buildPaginatedResponse(items, nextCursorPayload);
  }

  async createMessage(input: NewMessage, executor: Executor = this.db): Promise<Message> {
    const inserted = await executor
      .insertInto("messages")
      .values({
        chat_id: input.chatId,
        sender_id: input.senderId,
        kind: input.kind,
        body: input.body,
      })
      .returning(["id", "created_at"])
      .executeTakeFirstOrThrow();

    if (input.attachmentStoragePaths.length > 0) {
      await executor
        .insertInto("message_attachments")
        .values(
          input.attachmentStoragePaths.map((path) => ({ message_id: inserted.id, storage_path: path })),
        )
        .execute();
    }

    await executor.updateTable("chats").set({ updated_at: new Date().toISOString() }).where("id", "=", input.chatId).execute();

    const attachmentUrls = await Promise.all(
      input.attachmentStoragePaths.map((path) => this.attachmentStorage.createSignedUrl(path)),
    );

    return {
      id: inserted.id,
      chatId: input.chatId,
      senderId: input.senderId,
      kind: input.kind,
      body: input.body,
      attachmentUrls,
      createdAt: inserted.created_at,
    };
  }

  async createSystemMessage(chatId: string, body: string, executor: Executor = this.db): Promise<Message> {
    return this.createMessage(
      { chatId, senderId: null, kind: "system", body, attachmentStoragePaths: [] },
      executor,
    );
  }

  async markRead(chatId: string, userId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .insertInto("chat_read_state")
      .values({ chat_id: chatId, user_id: userId, last_read_at: new Date().toISOString() })
      .onConflict((oc) =>
        oc.columns(["chat_id", "user_id"]).doUpdateSet({ last_read_at: new Date().toISOString() }),
      )
      .execute();
  }

  async getLastReadAt(chatId: string, userId: string): Promise<Date | null> {
    const row = await this.db
      .selectFrom("chat_read_state")
      .select("last_read_at")
      .where("chat_id", "=", chatId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row?.last_read_at ?? null;
  }

  async totalUnreadForUser(userId: string, executor: Executor = this.db): Promise<number> {
    const result = await executor
      .selectFrom("messages")
      .innerJoin("chats", "chats.id", "messages.chat_id")
      .leftJoin("chat_read_state", (join) =>
        join
          .onRef("chat_read_state.chat_id", "=", "messages.chat_id")
          .on("chat_read_state.user_id", "=", userId),
      )
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where((eb) => eb.or([eb("chats.owner_id", "=", userId), eb("chats.other_user_id", "=", userId)]))
      .where((eb) => eb.or([eb("messages.sender_id", "!=", userId), eb("messages.sender_id", "is", null)]))
      .where((eb) =>
        eb.or([
          eb("chat_read_state.last_read_at", "is", null),
          eb("messages.created_at", ">", eb.ref("chat_read_state.last_read_at")),
        ]),
      )
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async isBlocked(blockerId: string, blockedId: string, executor: Executor = this.db): Promise<boolean> {
    const row = await executor
      .selectFrom("user_blocks")
      .select("blocker_id")
      .where("blocker_id", "=", blockerId)
      .where("blocked_id", "=", blockedId)
      .executeTakeFirst();
    return row !== undefined;
  }

  async blockUser(blockerId: string, blockedId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .insertInto("user_blocks")
      .values({ blocker_id: blockerId, blocked_id: blockedId })
      .onConflict((oc) => oc.columns(["blocker_id", "blocked_id"]).doNothing())
      .execute();
  }

  async unblockUser(blockerId: string, blockedId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .deleteFrom("user_blocks")
      .where("blocker_id", "=", blockerId)
      .where("blocked_id", "=", blockedId)
      .execute();
  }
}
