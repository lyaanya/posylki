import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseChatRepository } from "./chat.repository.supabase.js";
import type { IChatAttachmentStorage } from "./chat-attachment-storage.js";

describe("SupabaseChatRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseChatRepository;
  let ownerId: string;
  let otherUserId: string;
  let listingId: string;
  const createdUserIds: string[] = [];

  const fakeStorage: IChatAttachmentStorage = {
    upload: vi.fn(async () => "fake/path.jpg"),
    createSignedUrl: vi.fn(async (path: string) => `https://signed.example/${path}`),
  };

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseChatRepository(db, fakeStorage);

    ownerId = randomUUID();
    otherUserId = randomUUID();
    await sql`insert into auth.users (id, email) values (${ownerId}, ${`chat-owner-${ownerId}@example.com`})`.execute(
      db,
    );
    await sql`insert into auth.users (id, email) values (${otherUserId}, ${`chat-other-${otherUserId}@example.com`})`.execute(
      db,
    );
    createdUserIds.push(ownerId, otherUserId);
    await sql`update users set first_name = 'Курьер', last_name = 'Тестов' where id = ${ownerId}`.execute(db);

    const rub = await sql<{ id: string }>`select id from currencies where code = 'RUB'`.execute(db);
    const moscow = await sql<{ id: string }>`select id from cities where name_ru = 'Москва'`.execute(db);
    const nhaTrang = await sql<{ id: string }>`select id from cities where name_ru = 'Нячанг'`.execute(db);
    listingId = randomUUID();
    await sql`
      insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor)
      values (${listingId}, ${ownerId}, 'trip', ${moscow.rows[0]!.id}, ${nhaTrang.rows[0]!.id}, ${rub.rows[0]!.id}, '2027-01-01', '2027-01-01', 5000, 100000, 300000)
    `.execute(db);
  });

  afterAll(async () => {
    await sql`delete from listings where owner_id = any(${createdUserIds})`.execute(db);
    await sql`delete from auth.users where id = any(${createdUserIds})`.execute(db);
    await db.destroy();
  });

  async function createListing(dateFrom: string): Promise<string> {
    const rub = await sql<{ id: string }>`select id from currencies where code = 'RUB'`.execute(db);
    const moscow = await sql<{ id: string }>`select id from cities where name_ru = 'Москва'`.execute(db);
    const nhaTrang = await sql<{ id: string }>`select id from cities where name_ru = 'Нячанг'`.execute(db);
    const freshListingId = randomUUID();
    await sql`
      insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor)
      values (${freshListingId}, ${ownerId}, 'trip', ${moscow.rows[0]!.id}, ${nhaTrang.rows[0]!.id}, ${rub.rows[0]!.id}, ${dateFrom}, ${dateFrom}, 5000, 100000, 300000)
    `.execute(db);
    return freshListingId;
  }

  /** totalUnreadForUser считает непрочитанные глобально по всем чатам пользователя,
   * поэтому для проверки абсолютных чисел нужен пользователь без чужой истории. */
  async function createOwnerWithListing(dateFrom: string): Promise<{ ownerId: string; listingId: string }> {
    const freshOwnerId = randomUUID();
    await sql`insert into auth.users (id, email) values (${freshOwnerId}, ${`chat-owner-${freshOwnerId}@example.com`})`.execute(
      db,
    );
    createdUserIds.push(freshOwnerId);

    const rub = await sql<{ id: string }>`select id from currencies where code = 'RUB'`.execute(db);
    const moscow = await sql<{ id: string }>`select id from cities where name_ru = 'Москва'`.execute(db);
    const nhaTrang = await sql<{ id: string }>`select id from cities where name_ru = 'Нячанг'`.execute(db);
    const freshListingId = randomUUID();
    await sql`
      insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor)
      values (${freshListingId}, ${freshOwnerId}, 'trip', ${moscow.rows[0]!.id}, ${nhaTrang.rows[0]!.id}, ${rub.rows[0]!.id}, ${dateFrom}, ${dateFrom}, 5000, 100000, 300000)
    `.execute(db);
    return { ownerId: freshOwnerId, listingId: freshListingId };
  }

  it("findOrCreateChatByListing создаёт чат один раз и возвращает его же при повторном обращении", async () => {
    const first = await repository.findOrCreateChatByListing(listingId, ownerId, otherUserId);
    const second = await repository.findOrCreateChatByListing(listingId, ownerId, otherUserId);

    expect(second.id).toBe(first.id);
    expect(first.ownerId).toBe(ownerId);
    expect(first.otherUserId).toBe(otherUserId);
  });

  it("createMessage сохраняет текст, listMessages отдаёт его новым первым; вложения получают подписанные ссылки", async () => {
    const chat = await repository.findOrCreateChatByListing(listingId, ownerId, otherUserId);

    const first = await repository.createMessage({
      chatId: chat.id,
      senderId: otherUserId,
      kind: "text",
      body: "Возьмёте посылку 2 кг?",
      attachmentStoragePaths: [],
    });
    const withPhoto = await repository.createMessage({
      chatId: chat.id,
      senderId: ownerId,
      kind: "photo",
      body: null,
      attachmentStoragePaths: ["some/path.jpg"],
    });

    expect(first.body).toBe("Возьмёте посылку 2 кг?");
    expect(withPhoto.attachmentUrls).toEqual(["https://signed.example/some/path.jpg"]);

    const page = await repository.listMessages(chat.id, { limit: 20 });
    expect(page.items[0]!.id).toBe(withPhoto.id); // новые первыми
    expect(page.items.map((m) => m.id)).toContain(first.id);
  });

  it("createSystemMessage создаёт сообщение без отправителя", async () => {
    const chat = await repository.findOrCreateChatByListing(listingId, ownerId, otherUserId);
    const system = await repository.createSystemMessage(chat.id, "Сделка создана");

    expect(system.senderId).toBeNull();
    expect(system.kind).toBe("system");
  });

  it(
    "listMessages: cursor отдаёт более старые сообщения без повторов",
    async () => {
    const freshListingId = await createListing("2027-02-01");

    const chat = await repository.findOrCreateChatByListing(freshListingId, ownerId, otherUserId);
    const m1 = await repository.createMessage({
      chatId: chat.id,
      senderId: otherUserId,
      kind: "text",
      body: "1",
      attachmentStoragePaths: [],
    });
    const m2 = await repository.createMessage({
      chatId: chat.id,
      senderId: otherUserId,
      kind: "text",
      body: "2",
      attachmentStoragePaths: [],
    });
    const m3 = await repository.createMessage({
      chatId: chat.id,
      senderId: otherUserId,
      kind: "text",
      body: "3",
      attachmentStoragePaths: [],
    });

    const firstPage = await repository.listMessages(chat.id, { limit: 2 });
    expect(firstPage.items.map((m) => m.id)).toEqual([m3.id, m2.id]);
    expect(firstPage.next_cursor).not.toBeNull();

    const { decodeCursor } = await import("../common/pagination.js");
    const cursor = decodeCursor<{ sortValue: string; id: string }>(firstPage.next_cursor!);
    const secondPage = await repository.listMessages(chat.id, { limit: 2, cursor });
    expect(secondPage.items.map((m) => m.id)).toEqual([m1.id]);
    },
    15000,
  );

  it(
    "unreadCount и markRead: чужие сообщения считаются непрочитанными, пока не отмечены",
    async () => {
    // totalUnreadForUser — глобальный счётчик по всем чатам пользователя,
    // поэтому здесь нужен отдельный владелец без чужой истории из других тестов файла.
    const fresh = await createOwnerWithListing("2027-03-01");
    const chat = await repository.findOrCreateChatByListing(fresh.listingId, fresh.ownerId, otherUserId);
    expect(await repository.totalUnreadForUser(fresh.ownerId)).toBe(0);

    await repository.createMessage({
      chatId: chat.id,
      senderId: otherUserId,
      kind: "text",
      body: "Ждём ответа",
      attachmentStoragePaths: [],
    });
    expect(await repository.totalUnreadForUser(fresh.ownerId)).toBe(1);

    await repository.markRead(chat.id, fresh.ownerId);
    expect(await repository.totalUnreadForUser(fresh.ownerId)).toBe(0);

    // Собственные сообщения не считаются непрочитанными.
    await repository.createMessage({
      chatId: chat.id,
      senderId: fresh.ownerId,
      kind: "text",
      body: "Ок, беру",
      attachmentStoragePaths: [],
    });
    expect(await repository.totalUnreadForUser(fresh.ownerId)).toBe(0);
    },
    15000,
  );

  it(
    "listChatsForUser отдаёт собеседника, последнее сообщение и isBlockedByMe",
    async () => {
    const freshListingId = await createListing("2027-04-01");
    const chat = await repository.findOrCreateChatByListing(freshListingId, ownerId, otherUserId);
    await repository.createMessage({
      chatId: chat.id,
      senderId: otherUserId,
      kind: "text",
      body: "Привет!",
      attachmentStoragePaths: [],
    });

    const ownerChats = await repository.listChatsForUser(ownerId);
    const summary = ownerChats.find((c) => c.id === chat.id);
    expect(summary?.counterpart.id).toBe(otherUserId);
    expect(summary?.lastMessage?.body).toBe("Привет!");
    expect(summary?.isBlockedByMe).toBe(false);

    await repository.blockUser(ownerId, otherUserId);
    const afterBlock = await repository.listChatsForUser(ownerId);
    expect(afterBlock.find((c) => c.id === chat.id)?.isBlockedByMe).toBe(true);
    expect(await repository.isBlocked(ownerId, otherUserId)).toBe(true);

    await repository.unblockUser(ownerId, otherUserId);
    expect(await repository.isBlocked(ownerId, otherUserId)).toBe(false);
    },
    15000,
  );
});
