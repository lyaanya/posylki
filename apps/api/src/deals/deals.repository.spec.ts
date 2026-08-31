import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseDealsRepository } from "./deals.repository.supabase.js";
import type { IDealPhotoStorage } from "./deal-photo-storage.js";

describe("SupabaseDealsRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseDealsRepository;
  let customerId: string;
  let courierId: string;
  let chatId: string;
  let listingId: string;
  let rubId: string;
  const createdUserIds: string[] = [];

  const fakeStorage: IDealPhotoStorage = {
    upload: vi.fn(async () => "fake/photo.jpg"),
    createSignedUrl: vi.fn(async (path: string) => `https://signed.example/${path}`),
  };

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseDealsRepository(db, fakeStorage);

    customerId = randomUUID();
    courierId = randomUUID();
    await sql`insert into auth.users (id, email) values (${customerId}, ${`deal-customer-${customerId}@example.com`})`.execute(
      db,
    );
    await sql`insert into auth.users (id, email) values (${courierId}, ${`deal-courier-${courierId}@example.com`})`.execute(
      db,
    );
    createdUserIds.push(customerId, courierId);
    await sql`update users set first_name = 'Заказчик', last_name = 'Тестов' where id = ${customerId}`.execute(db);
    await sql`update users set first_name = 'Курьер', last_name = 'Тестов' where id = ${courierId}`.execute(db);

    const rub = await sql<{ id: string }>`select id from currencies where code = 'RUB'`.execute(db);
    rubId = rub.rows[0]!.id;
    const moscow = await sql<{ id: string }>`select id from cities where name_ru = 'Москва'`.execute(db);
    const nhaTrang = await sql<{ id: string }>`select id from cities where name_ru = 'Нячанг'`.execute(db);

    listingId = randomUUID();
    await sql`
      insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor, storage_until_date)
      values (${listingId}, ${courierId}, 'trip', ${moscow.rows[0]!.id}, ${nhaTrang.rows[0]!.id}, ${rubId}, '2027-07-01', '2027-07-01', 8000, 100000, 300000, '2027-07-15')
    `.execute(db);

    chatId = randomUUID();
    await sql`insert into chats (id, listing_id, owner_id, other_user_id) values (${chatId}, ${listingId}, ${courierId}, ${customerId})`.execute(
      db,
    );
  });

  afterAll(async () => {
    await sql`delete from listings where id = ${listingId}`.execute(db);
    await sql`delete from auth.users where id = any(${createdUserIds})`.execute(db);
    await db.destroy();
  });

  it(
    "проходит полный жизненный цикл: создание, опись, условия, согласие, передача, выдача, завершение",
    async () => {
    const deal = await repository.create({
      chatId,
      listingId,
      customerId,
      courierId,
      currencyId: rubId,
      createdBy: customerId,
    });

    expect(deal.status).toBe("responded");
    expect(deal.customer.name).toBe("Заказчик Тестов");
    expect(deal.courier.name).toBe("Курьер Тестов");
    expect(deal.fromCity).toBe("Москва");
    expect(deal.statusLog).toHaveLength(1);
    expect(deal.statusLog[0]!.toStatus).toBe("responded");
    expect(deal.statusLog[0]!.actorId).toBe(customerId);

    const item = await repository.addItem(deal.id, {
      name: "Крем для лица",
      quantity: 2,
      weightGrams: 400,
      warningText: null,
      aiCheckFailed: false,
    });
    expect(item.name).toBe("Крем для лица");
    expect(item.quantity).toBe(2);

    await repository.setTerms(deal.id, { declaredWeightGrams: 2000, priceMinor: 250_000 });
    await repository.recordConsent(deal.id, customerId, "stop_list", new Date());
    await repository.recordConsent(deal.id, courierId, "stop_list", new Date());
    expect(await repository.hasConsent(deal.id, customerId, "stop_list")).toBe(true);
    expect(await repository.hasConsent(deal.id, courierId, "item_warning")).toBe(false);

    await repository.markAgreed(deal.id, "customer");
    let refreshed = await repository.findById(deal.id);
    expect(refreshed?.customerAgreedAt).not.toBeNull();
    expect(refreshed?.courierAgreedAt).toBeNull();

    await repository.markAgreed(deal.id, "courier");
    await repository.setReservedWeight(deal.id, 2000);
    await repository.setStatus(deal.id, "agreed");
    await repository.logStatusChange(deal.id, "responded", "agreed", courierId, null);

    refreshed = await repository.findById(deal.id);
    expect(refreshed?.status).toBe("agreed");
    expect(refreshed?.declaredWeightGrams).toBe(2000);
    expect(refreshed?.payableWeightGrams).toBe(2000);
    expect(refreshed?.reservedWeightGrams).toBe(2000);

    await repository.upsertContact(deal.id, {
      event: "handover",
      role: "customer",
      name: "Мама заказчика",
      phone: "+7 900 000-00-00",
    });
    await repository.upsertContact(deal.id, {
      event: "handover",
      role: "customer",
      name: "Мама заказчика (уточнено)",
      phone: "+7 900 000-00-01",
    });

    await repository.setActualWeight(deal.id, 1500);
    refreshed = await repository.findById(deal.id);
    expect(refreshed?.payableWeightGrams).toBe(2000); // greatest(заявленный, фактический) — ТЗ п.10.15
    expect(refreshed?.contacts).toHaveLength(1);
    expect(refreshed?.contacts[0]!.name).toBe("Мама заказчика (уточнено)");

    await repository.addPhoto(deal.id, "some/photo.jpg", courierId);
    expect(await repository.countPhotos(deal.id)).toBe(1);

    await repository.markCourierHandedOver(deal.id);
    await repository.markCustomerHandedOverConfirmed(deal.id);
    await repository.setStatus(deal.id, "handed_over");
    await repository.logStatusChange(deal.id, "agreed", "handed_over", courierId, null);

    await repository.setStatus(deal.id, "in_transit");
    await repository.logStatusChange(deal.id, "handed_over", "in_transit", null, "авто");
    await repository.setStatus(deal.id, "awaiting_pickup");
    await repository.logStatusChange(deal.id, "in_transit", "awaiting_pickup", null, "авто");
    await repository.setStatus(deal.id, "delivered");
    await repository.logStatusChange(deal.id, "awaiting_pickup", "delivered", courierId, null);
    await repository.setStatus(deal.id, "completed");
    await repository.logStatusChange(deal.id, "delivered", "completed", customerId, null);

    refreshed = await repository.findById(deal.id);
    expect(refreshed?.status).toBe("completed");
    expect(refreshed?.statusLog.map((l) => l.toStatus)).toEqual([
      "responded",
      "agreed",
      "handed_over",
      "in_transit",
      "awaiting_pickup",
      "delivered",
      "completed",
    ]);
    expect(refreshed?.photos[0]!.url).toBe("https://signed.example/some/photo.jpg");
    },
    45000,
  );

  it(
    "findByChatId и findForUser находят сделку по её участникам и чату",
    async () => {
    const deal = await repository.create({
      chatId,
      listingId,
      customerId,
      courierId,
      currencyId: rubId,
      createdBy: customerId,
    });

    const byChat = await repository.findByChatId(chatId);
    expect(byChat.map((d) => d.id)).toContain(deal.id);

    const forCustomer = await repository.findForUser(customerId);
    expect(forCustomer.map((d) => d.id)).toContain(deal.id);
    const forCourier = await repository.findForUser(courierId);
    expect(forCourier.map((d) => d.id)).toContain(deal.id);
    },
    15000,
  );

  it("отмена записывает причину и комментарий", async () => {
    const deal = await repository.create({
      chatId,
      listingId,
      customerId,
      courierId,
      currencyId: rubId,
      createdBy: customerId,
    });

    await repository.setCancellation(deal.id, "changed_mind", "Передумал в последний момент");
    await repository.setStatus(deal.id, "cancelled");
    await repository.logStatusChange(deal.id, "responded", "cancelled", customerId, "Передумал в последний момент");

    const refreshed = await repository.findById(deal.id);
    expect(refreshed?.status).toBe("cancelled");
    expect(refreshed?.cancelReason).toBe("changed_mind");
    expect(refreshed?.cancelComment).toBe("Передумал в последний момент");
  });

  it(
    "продление хранения: запрос, одобрение и отклонение",
    async () => {
      const deal = await repository.create({
        chatId,
        listingId,
        customerId,
        courierId,
        currencyId: rubId,
        createdBy: customerId,
      });

      const request = await repository.createStorageExtensionRequest({
        dealId: deal.id,
        requestedBy: customerId,
        requestedUntilDate: "2027-07-20",
      });
      expect(request.status).toBe("pending");

      const approved = await repository.decideStorageExtensionRequest(request.id, "approved", courierId);
      expect(approved?.status).toBe("approved");
      expect(approved?.decidedBy).toBe(courierId);

      const secondRequest = await repository.createStorageExtensionRequest({
        dealId: deal.id,
        requestedBy: customerId,
        requestedUntilDate: "2027-07-25",
      });
      const rejected = await repository.decideStorageExtensionRequest(secondRequest.id, "rejected", courierId);
      expect(rejected?.status).toBe("rejected");

      const refreshed = await repository.findById(deal.id);
      expect(refreshed?.storageExtensionRequests).toHaveLength(2);
    },
    15000,
  );

  it(
    "автопереходы: находит сделки для перехода по датам, автозавершению, истечению хранения и напоминаниям",
    async () => {
      const freshListingId = randomUUID();
      const moscow = await sql<{ id: string }>`select id from cities where name_ru = 'Москва'`.execute(db);
      const nhaTrang = await sql<{ id: string }>`select id from cities where name_ru = 'Нячанг'`.execute(db);
      await sql`
        insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor, storage_until_date)
        values (${freshListingId}, ${courierId}, 'trip', ${moscow.rows[0]!.id}, ${nhaTrang.rows[0]!.id}, ${rubId}, '2020-01-01', '2020-01-02', 8000, 100000, 300000, '2020-01-10')
      `.execute(db);
      const freshChatId = randomUUID();
      await sql`insert into chats (id, listing_id, owner_id, other_user_id) values (${freshChatId}, ${freshListingId}, ${courierId}, ${customerId})`.execute(
        db,
      );

      const handedOverDeal = await repository.create({
        chatId: freshChatId,
        listingId: freshListingId,
        customerId,
        courierId,
        currencyId: rubId,
        createdBy: customerId,
      });
      await repository.setStatus(handedOverDeal.id, "handed_over");

      const pastDeparture = await repository.findHandedOverPastDeparture("2026-01-01");
      expect(pastDeparture.map((d) => d.id)).toContain(handedOverDeal.id);

      await repository.setStatus(handedOverDeal.id, "in_transit");
      const pastArrival = await repository.findInTransitPastArrival("2026-01-01");
      expect(pastArrival.map((d) => d.id)).toContain(handedOverDeal.id);

      await repository.setStatus(handedOverDeal.id, "awaiting_pickup");
      // storage_until_date копируется на сделку только при переходе в agreed
      // (deals-transitions.service.ts) — здесь тестируем репозиторий напрямую,
      // поэтому проставляем его вручную.
      await repository.setStorageUntilDate(handedOverDeal.id, "2020-01-10");
      const pastStorage = await repository.findAwaitingPickupPastStorage("2026-01-01");
      expect(pastStorage.map((d) => d.id)).toContain(handedOverDeal.id);

      await repository.setStatus(handedOverDeal.id, "delivered");
      await repository.logStatusChange(handedOverDeal.id, "awaiting_pickup", "delivered", courierId, null);
      const oldCutoff = new Date();
      oldCutoff.setUTCFullYear(oldCutoff.getUTCFullYear() + 1); // заведомо позже, чем только что записанный лог
      const staleDelivered = await repository.findDeliveredBefore(oldCutoff);
      expect(staleDelivered.map((d) => d.id)).toContain(handedOverDeal.id);

      // Напоминания: отдельная сделка, ещё ожидающая, с известной датой хранения.
      const reminderListingId = randomUUID();
      await sql`
        insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor, storage_until_date)
        values (${reminderListingId}, ${courierId}, 'trip', ${moscow.rows[0]!.id}, ${nhaTrang.rows[0]!.id}, ${rubId}, '2028-01-01', '2028-01-01', 8000, 100000, 300000, '2028-01-10')
      `.execute(db);
      const reminderChatId = randomUUID();
      await sql`insert into chats (id, listing_id, owner_id, other_user_id) values (${reminderChatId}, ${reminderListingId}, ${courierId}, ${customerId})`.execute(
        db,
      );
      const reminderDeal = await repository.create({
        chatId: reminderChatId,
        listingId: reminderListingId,
        customerId,
        courierId,
        currencyId: rubId,
        createdBy: customerId,
      });
      await repository.setStatus(reminderDeal.id, "awaiting_pickup");
      await repository.setStorageUntilDate(reminderDeal.id, "2028-01-10");

      const dueForReminder = await repository.findForStorageReminder("expiry", "2028-01-10");
      expect(dueForReminder.map((d) => d.id)).toContain(reminderDeal.id);

      await repository.markReminderSent(reminderDeal.id, "expiry");
      const afterMarking = await repository.findForStorageReminder("expiry", "2028-01-10");
      expect(afterMarking.map((d) => d.id)).not.toContain(reminderDeal.id);

      await sql`delete from listings where id in (${freshListingId}, ${reminderListingId})`.execute(db);
    },
    15000,
  );
});
