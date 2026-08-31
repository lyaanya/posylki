import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { DATABASE } from "../database/database.module.js";
import type { DB, Executor } from "../database/database.js";
import { DEAL_PHOTO_STORAGE, type IDealPhotoStorage } from "./deal-photo-storage.js";
import type { IDealsRepository } from "./deals.repository.js";
import type {
  ConsentType,
  ContactEvent,
  ContactRole,
  Deal,
  DealCancelReason,
  DealConsent,
  DealContact,
  DealItem,
  DealParticipant,
  DealPhoto,
  DealStatus,
  DealStatusLogEntry,
  NewDeal,
  NewDealItem,
  StorageExtensionRequest,
} from "./deals.types.js";

interface DealRow {
  id: string;
  chat_id: string;
  listing_id: string;
  status: DealStatus;
  declared_weight_grams: number | null;
  actual_weight_grams: number | null;
  reserved_weight_grams: number | null;
  price_minor: number | null;
  storage_until_date: Date | null;
  customer_agreed_at: Date | null;
  courier_agreed_at: Date | null;
  courier_handed_over_at: Date | null;
  customer_handed_over_confirmed_at: Date | null;
  cancel_reason: DealCancelReason | null;
  cancel_comment: string | null;
  needs_review: boolean;
  created_at: Date;
  updated_at: Date;
  currency_code: string;
  currency_symbol: string;
  from_city_id: string;
  from_city_name: string;
  to_city_id: string;
  to_city_name: string;
  date_from: Date;
  date_to: Date;
  customer_id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string;
  customer_avatar_url: string | null;
  courier_id: string;
  courier_first_name: string | null;
  courier_last_name: string | null;
  courier_email: string;
  courier_avatar_url: string | null;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function participantName(row: { first_name: string | null; last_name: string | null; email: string }): string {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  if (fullName.length > 0) return fullName;
  return row.email.split("@")[0] ?? "Пользователь";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function toParticipant(row: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
}): DealParticipant {
  const name = participantName(row);
  return { id: row.id, name, initials: initialsOf(name), avatarUrl: row.avatar_url };
}

@Injectable()
export class SupabaseDealsRepository implements IDealsRepository {
  constructor(
    @Inject(DATABASE) private readonly db: Kysely<DB>,
    @Inject(DEAL_PHOTO_STORAGE) private readonly photoStorage: IDealPhotoStorage,
  ) {}

  private baseQuery(executor: Executor) {
    return executor
      .selectFrom("deals")
      .innerJoin("listings", "listings.id", "deals.listing_id")
      .innerJoin("cities as from_city", "from_city.id", "listings.from_city_id")
      .innerJoin("cities as to_city", "to_city.id", "listings.to_city_id")
      .innerJoin("currencies", "currencies.id", "deals.currency_id")
      .innerJoin("users as customer", "customer.id", "deals.customer_id")
      .innerJoin("users as courier", "courier.id", "deals.courier_id")
      .select([
        "deals.id as id",
        "deals.chat_id as chat_id",
        "deals.listing_id as listing_id",
        "deals.status as status",
        "deals.declared_weight_grams as declared_weight_grams",
        "deals.actual_weight_grams as actual_weight_grams",
        "deals.reserved_weight_grams as reserved_weight_grams",
        "deals.price_minor as price_minor",
        "deals.storage_until_date as storage_until_date",
        "deals.customer_agreed_at as customer_agreed_at",
        "deals.courier_agreed_at as courier_agreed_at",
        "deals.courier_handed_over_at as courier_handed_over_at",
        "deals.customer_handed_over_confirmed_at as customer_handed_over_confirmed_at",
        "deals.cancel_reason as cancel_reason",
        "deals.cancel_comment as cancel_comment",
        "deals.needs_review as needs_review",
        "deals.created_at as created_at",
        "deals.updated_at as updated_at",
        "currencies.code as currency_code",
        "currencies.symbol as currency_symbol",
        "from_city.id as from_city_id",
        "from_city.name_ru as from_city_name",
        "to_city.id as to_city_id",
        "to_city.name_ru as to_city_name",
        "listings.date_from as date_from",
        "listings.date_to as date_to",
        "customer.id as customer_id",
        "customer.first_name as customer_first_name",
        "customer.last_name as customer_last_name",
        "customer.email as customer_email",
        "customer.avatar_url as customer_avatar_url",
        "courier.id as courier_id",
        "courier.first_name as courier_first_name",
        "courier.last_name as courier_last_name",
        "courier.email as courier_email",
        "courier.avatar_url as courier_avatar_url",
      ]);
  }

  private async hydrate(row: DealRow, executor: Executor): Promise<Deal> {
    const [itemRows, photoRows, contactRows, consentRows, extensionRows, logRows] = await Promise.all([
      executor.selectFrom("deal_items").selectAll().where("deal_id", "=", row.id).execute(),
      executor.selectFrom("deal_photos").selectAll().where("deal_id", "=", row.id).execute(),
      executor.selectFrom("deal_contacts").selectAll().where("deal_id", "=", row.id).execute(),
      executor.selectFrom("deal_consents").selectAll().where("deal_id", "=", row.id).execute(),
      executor
        .selectFrom("storage_extension_requests")
        .selectAll()
        .where("deal_id", "=", row.id)
        .orderBy("created_at", "desc")
        .execute(),
      executor
        .selectFrom("deal_status_log")
        .selectAll()
        .where("deal_id", "=", row.id)
        .orderBy("created_at", "asc")
        .execute(),
    ]);

    const items: DealItem[] = itemRows.map((r) => ({
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      weightGrams: r.weight_grams,
      warningText: r.warning_text,
      aiCheckFailed: r.ai_check_failed,
      createdAt: r.created_at,
    }));

    const photos: DealPhoto[] = await Promise.all(
      photoRows.map(async (r) => ({
        id: r.id,
        url: await this.photoStorage.createSignedUrl(r.storage_path),
        uploadedBy: r.uploaded_by,
        createdAt: r.created_at,
      })),
    );

    const contacts: DealContact[] = contactRows.map((r) => ({
      event: r.event,
      role: r.role,
      name: r.name,
      phone: r.phone,
    }));

    const consents: DealConsent[] = consentRows.map((r) => ({
      userId: r.user_id,
      consentType: r.consent_type,
      consentedAt: r.consented_at,
    }));

    const storageExtensionRequests: StorageExtensionRequest[] = extensionRows.map((r) => ({
      id: r.id,
      requestedBy: r.requested_by,
      requestedUntilDate: formatDate(new Date(r.requested_until_date)),
      status: r.status,
      decidedBy: r.decided_by,
      decidedAt: r.decided_at,
      createdAt: r.created_at,
    }));

    const statusLog: DealStatusLogEntry[] = logRows.map((r) => ({
      id: r.id,
      fromStatus: r.from_status as DealStatus | null,
      toStatus: r.to_status as DealStatus,
      actorId: r.actor_id,
      comment: r.comment,
      createdAt: r.created_at,
    }));

    const payableWeightGrams =
      row.declared_weight_grams === null
        ? null
        : Math.max(row.declared_weight_grams, row.actual_weight_grams ?? 0);

    return {
      id: row.id,
      chatId: row.chat_id,
      listingId: row.listing_id,
      dealType: "delivery",
      status: row.status,
      customer: toParticipant({
        id: row.customer_id,
        first_name: row.customer_first_name,
        last_name: row.customer_last_name,
        email: row.customer_email,
        avatar_url: row.customer_avatar_url,
      }),
      courier: toParticipant({
        id: row.courier_id,
        first_name: row.courier_first_name,
        last_name: row.courier_last_name,
        email: row.courier_email,
        avatar_url: row.courier_avatar_url,
      }),
      fromCityId: row.from_city_id,
      fromCity: row.from_city_name,
      toCityId: row.to_city_id,
      toCity: row.to_city_name,
      dateFrom: formatDate(new Date(row.date_from)),
      dateTo: formatDate(new Date(row.date_to)),
      declaredWeightGrams: row.declared_weight_grams,
      actualWeightGrams: row.actual_weight_grams,
      payableWeightGrams,
      reservedWeightGrams: row.reserved_weight_grams,
      priceMinor: row.price_minor,
      currencyCode: row.currency_code,
      currencySymbol: row.currency_symbol,
      storageUntilDate: row.storage_until_date ? formatDate(new Date(row.storage_until_date)) : null,
      customerAgreedAt: row.customer_agreed_at,
      courierAgreedAt: row.courier_agreed_at,
      courierHandedOverAt: row.courier_handed_over_at,
      customerHandedOverConfirmedAt: row.customer_handed_over_confirmed_at,
      cancelReason: row.cancel_reason,
      cancelComment: row.cancel_comment,
      needsReview: row.needs_review,
      items,
      photos,
      contacts,
      consents,
      storageExtensionRequests,
      statusLog,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(input: NewDeal, executor: Executor = this.db): Promise<Deal> {
    const inserted = await executor
      .insertInto("deals")
      .values({
        chat_id: input.chatId,
        listing_id: input.listingId,
        customer_id: input.customerId,
        courier_id: input.courierId,
        currency_id: input.currencyId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await this.logStatusChange(inserted.id, null, "responded", input.createdBy, null, executor);

    const created = await this.findById(inserted.id, executor);
    if (!created) throw new Error("Сделка не найдена сразу после создания");
    return created;
  }

  async findById(id: string, executor: Executor = this.db): Promise<Deal | null> {
    const row = (await this.baseQuery(executor).where("deals.id", "=", id).executeTakeFirst()) as
      | DealRow
      | undefined;
    if (!row) return null;
    return this.hydrate(row, executor);
  }

  async findByChatId(chatId: string, executor: Executor = this.db): Promise<Deal[]> {
    const rows = (await this.baseQuery(executor)
      .where("deals.chat_id", "=", chatId)
      .orderBy("deals.created_at", "desc")
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async findForUser(userId: string, executor: Executor = this.db): Promise<Deal[]> {
    const rows = (await this.baseQuery(executor)
      .where((eb) => eb.or([eb("deals.customer_id", "=", userId), eb("deals.courier_id", "=", userId)]))
      .orderBy("deals.updated_at", "desc")
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async addItem(dealId: string, input: NewDealItem, executor: Executor = this.db): Promise<DealItem> {
    const inserted = await executor
      .insertInto("deal_items")
      .values({
        deal_id: dealId,
        name: input.name,
        quantity: input.quantity,
        weight_grams: input.weightGrams,
        warning_text: input.warningText,
        ai_check_failed: input.aiCheckFailed,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: inserted.id,
      name: inserted.name,
      quantity: inserted.quantity,
      weightGrams: inserted.weight_grams,
      warningText: inserted.warning_text,
      aiCheckFailed: inserted.ai_check_failed,
      createdAt: inserted.created_at,
    };
  }

  async upsertContact(
    dealId: string,
    contact: { event: ContactEvent; role: ContactRole; name: string; phone: string },
    executor: Executor = this.db,
  ): Promise<void> {
    await executor
      .insertInto("deal_contacts")
      .values({
        deal_id: dealId,
        event: contact.event,
        role: contact.role,
        name: contact.name,
        phone: contact.phone,
      })
      .onConflict((oc) =>
        oc.columns(["deal_id", "event", "role"]).doUpdateSet({ name: contact.name, phone: contact.phone }),
      )
      .execute();
  }

  async recordConsent(
    dealId: string,
    userId: string,
    type: ConsentType,
    stopListVersion: Date | null,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor
      .insertInto("deal_consents")
      .values({
        deal_id: dealId,
        user_id: userId,
        consent_type: type,
        stop_list_version: stopListVersion ? stopListVersion.toISOString() : null,
      })
      .onConflict((oc) => oc.columns(["deal_id", "user_id", "consent_type"]).doNothing())
      .execute();
  }

  async hasConsent(
    dealId: string,
    userId: string,
    type: ConsentType,
    executor: Executor = this.db,
  ): Promise<boolean> {
    const row = await executor
      .selectFrom("deal_consents")
      .select("id")
      .where("deal_id", "=", dealId)
      .where("user_id", "=", userId)
      .where("consent_type", "=", type)
      .executeTakeFirst();
    return row !== undefined;
  }

  async setTerms(
    dealId: string,
    input: { declaredWeightGrams?: number; priceMinor?: number },
    executor: Executor = this.db,
  ): Promise<void> {
    const update: { declared_weight_grams?: number; price_minor?: number } = {};
    if (input.declaredWeightGrams !== undefined) update.declared_weight_grams = input.declaredWeightGrams;
    if (input.priceMinor !== undefined) update.price_minor = input.priceMinor;
    if (Object.keys(update).length === 0) return;
    await executor.updateTable("deals").set(update).where("id", "=", dealId).execute();
  }

  async markAgreed(dealId: string, role: "customer" | "courier", executor: Executor = this.db): Promise<void> {
    const column = role === "customer" ? "customer_agreed_at" : "courier_agreed_at";
    await executor
      .updateTable("deals")
      .set({ [column]: new Date().toISOString() })
      .where("id", "=", dealId)
      .execute();
  }

  async resetAgreement(dealId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .updateTable("deals")
      .set({ customer_agreed_at: null, courier_agreed_at: null })
      .where("id", "=", dealId)
      .execute();
  }

  async setStatus(dealId: string, status: DealStatus, executor: Executor = this.db): Promise<void> {
    await executor.updateTable("deals").set({ status }).where("id", "=", dealId).execute();
  }

  async logStatusChange(
    dealId: string,
    from: DealStatus | null,
    to: DealStatus,
    actorId: string | null,
    comment: string | null,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor
      .insertInto("deal_status_log")
      .values({ deal_id: dealId, from_status: from, to_status: to, actor_id: actorId, comment })
      .execute();
  }

  async setActualWeight(dealId: string, grams: number, executor: Executor = this.db): Promise<void> {
    await executor
      .updateTable("deals")
      .set({ actual_weight_grams: grams })
      .where("id", "=", dealId)
      .execute();
  }

  async setReservedWeight(
    dealId: string,
    grams: number | null,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor
      .updateTable("deals")
      .set({ reserved_weight_grams: grams })
      .where("id", "=", dealId)
      .execute();
  }

  async markCourierHandedOver(dealId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .updateTable("deals")
      .set({ courier_handed_over_at: new Date().toISOString() })
      .where("id", "=", dealId)
      .execute();
  }

  async markCustomerHandedOverConfirmed(dealId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .updateTable("deals")
      .set({ customer_handed_over_confirmed_at: new Date().toISOString() })
      .where("id", "=", dealId)
      .execute();
  }

  async addPhoto(
    dealId: string,
    storagePath: string,
    uploadedBy: string,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor
      .insertInto("deal_photos")
      .values({ deal_id: dealId, storage_path: storagePath, uploaded_by: uploadedBy })
      .execute();
  }

  async countPhotos(dealId: string, executor: Executor = this.db): Promise<number> {
    const result = await executor
      .selectFrom("deal_photos")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("deal_id", "=", dealId)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async setCancellation(
    dealId: string,
    reason: DealCancelReason,
    comment: string | null,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor
      .updateTable("deals")
      .set({ cancel_reason: reason, cancel_comment: comment })
      .where("id", "=", dealId)
      .execute();
  }

  async setNeedsReview(dealId: string, value: boolean, executor: Executor = this.db): Promise<void> {
    await executor.updateTable("deals").set({ needs_review: value }).where("id", "=", dealId).execute();
  }

  async setStorageUntilDate(dealId: string, date: string, executor: Executor = this.db): Promise<void> {
    await executor
      .updateTable("deals")
      .set({ storage_until_date: date })
      .where("id", "=", dealId)
      .execute();
  }

  async createStorageExtensionRequest(
    input: { dealId: string; requestedBy: string; requestedUntilDate: string },
    executor: Executor = this.db,
  ): Promise<StorageExtensionRequest> {
    const inserted = await executor
      .insertInto("storage_extension_requests")
      .values({
        deal_id: input.dealId,
        requested_by: input.requestedBy,
        requested_until_date: input.requestedUntilDate,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: inserted.id,
      requestedBy: inserted.requested_by,
      requestedUntilDate: formatDate(new Date(inserted.requested_until_date)),
      status: inserted.status,
      decidedBy: inserted.decided_by,
      decidedAt: inserted.decided_at,
      createdAt: inserted.created_at,
    };
  }

  async findStorageExtensionRequest(
    id: string,
    executor: Executor = this.db,
  ): Promise<StorageExtensionRequest | null> {
    const row = await executor
      .selectFrom("storage_extension_requests")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      requestedBy: row.requested_by,
      requestedUntilDate: formatDate(new Date(row.requested_until_date)),
      status: row.status,
      decidedBy: row.decided_by,
      decidedAt: row.decided_at,
      createdAt: row.created_at,
    };
  }

  async decideStorageExtensionRequest(
    id: string,
    status: "approved" | "rejected",
    decidedBy: string,
    executor: Executor = this.db,
  ): Promise<StorageExtensionRequest | null> {
    await executor
      .updateTable("storage_extension_requests")
      .set({ status, decided_by: decidedBy, decided_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
    return this.findStorageExtensionRequest(id, executor);
  }

  async findHandedOverPastDeparture(cutoffDate: string, executor: Executor = this.db): Promise<Deal[]> {
    const cutoff = new Date(`${cutoffDate}T00:00:00Z`);
    const rows = (await this.baseQuery(executor)
      .where("deals.status", "=", "handed_over")
      .where("listings.date_from", "<=", cutoff)
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async findInTransitPastArrival(cutoffDate: string, executor: Executor = this.db): Promise<Deal[]> {
    const cutoff = new Date(`${cutoffDate}T00:00:00Z`);
    const rows = (await this.baseQuery(executor)
      .where("deals.status", "=", "in_transit")
      .where("listings.date_to", "<=", cutoff)
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async findDeliveredBefore(cutoff: Date, executor: Executor = this.db): Promise<Deal[]> {
    const rows = (await this.baseQuery(executor)
      .where("deals.status", "=", "delivered")
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("deal_status_log")
            .select("id")
            .whereRef("deal_status_log.deal_id", "=", "deals.id")
            .where("deal_status_log.to_status", "=", "delivered")
            .where("deal_status_log.created_at", "<=", cutoff),
        ),
      )
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async findAwaitingPickupPastStorage(cutoffDate: string, executor: Executor = this.db): Promise<Deal[]> {
    const cutoff = new Date(`${cutoffDate}T00:00:00Z`);
    const rows = (await this.baseQuery(executor)
      .where("deals.status", "=", "awaiting_pickup")
      .where("deals.storage_until_date", "is not", null)
      .where("deals.storage_until_date", "<", cutoff)
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async findForStorageReminder(
    kind: "3d" | "1d" | "expiry",
    targetDate: string,
    executor: Executor = this.db,
  ): Promise<Deal[]> {
    const flagColumn =
      kind === "3d" ? "reminder_3d_sent" : kind === "1d" ? "reminder_1d_sent" : "reminder_expiry_sent";
    const target = new Date(`${targetDate}T00:00:00Z`);
    const rows = (await this.baseQuery(executor)
      .where("deals.status", "=", "awaiting_pickup")
      .where(`deals.${flagColumn}`, "=", false)
      .where("deals.storage_until_date", "=", target)
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async markReminderSent(
    dealId: string,
    kind: "3d" | "1d" | "expiry",
    executor: Executor = this.db,
  ): Promise<void> {
    const column = kind === "3d" ? "reminder_3d_sent" : kind === "1d" ? "reminder_1d_sent" : "reminder_expiry_sent";
    await executor
      .updateTable("deals")
      .set({ [column]: true })
      .where("id", "=", dealId)
      .execute();
  }

  async findCompletedInWindow(from: Date, to: Date, executor: Executor = this.db): Promise<Deal[]> {
    const rows = (await this.baseQuery(executor)
      .where("deals.status", "=", "completed")
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("deal_status_log")
            .select("id")
            .whereRef("deal_status_log.deal_id", "=", "deals.id")
            .where("deal_status_log.to_status", "=", "completed")
            .where("deal_status_log.created_at", ">=", from)
            .where("deal_status_log.created_at", "<", to),
        ),
      )
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async findByStatus(status: DealStatus, executor: Executor = this.db): Promise<Deal[]> {
    const rows = (await this.baseQuery(executor)
      .where("deals.status", "=", status)
      .orderBy("deals.updated_at", "desc")
      .execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }

  async findAllForAdmin(
    filters: {
      status?: DealStatus | undefined;
      fromCityId?: string | undefined;
      toCityId?: string | undefined;
      participantUserId?: string | undefined;
      dateFrom?: string | undefined;
      dateTo?: string | undefined;
    },
    executor: Executor = this.db,
  ): Promise<Deal[]> {
    let query = this.baseQuery(executor);
    if (filters.status) query = query.where("deals.status", "=", filters.status);
    if (filters.fromCityId) query = query.where("from_city.id", "=", filters.fromCityId);
    if (filters.toCityId) query = query.where("to_city.id", "=", filters.toCityId);
    if (filters.participantUserId) {
      const userId = filters.participantUserId;
      query = query.where((eb) => eb.or([eb("deals.customer_id", "=", userId), eb("deals.courier_id", "=", userId)]));
    }
    if (filters.dateFrom) query = query.where("deals.created_at", ">=", new Date(filters.dateFrom));
    if (filters.dateTo) query = query.where("deals.created_at", "<=", new Date(filters.dateTo));

    const rows = (await query.orderBy("deals.created_at", "desc").limit(200).execute()) as DealRow[];
    return Promise.all(rows.map((row) => this.hydrate(row, executor)));
  }
}
