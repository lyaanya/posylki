import type { Executor } from "../database/database.js";
import type {
  ConsentType,
  ContactEvent,
  ContactRole,
  Deal,
  DealCancelReason,
  DealItem,
  DealStatus,
  NewDeal,
  NewDealItem,
  StorageExtensionRequest,
} from "./deals.types.js";

export interface IDealsRepository {
  create(input: NewDeal, executor?: Executor): Promise<Deal>;
  findById(id: string, executor?: Executor): Promise<Deal | null>;
  findByChatId(chatId: string, executor?: Executor): Promise<Deal[]>;
  /** Сделки, где пользователь — заказчик или курьер, новые сверху (для "мои сделки"). */
  findForUser(userId: string, executor?: Executor): Promise<Deal[]>;
  /** ТЗ E16 п.16.21 — список сделок для админ-панели с фильтрами. */
  findAllForAdmin(
    filters: {
      status?: DealStatus | undefined;
      fromCityId?: string | undefined;
      toCityId?: string | undefined;
      participantUserId?: string | undefined;
      dateFrom?: string | undefined;
      dateTo?: string | undefined;
    },
    executor?: Executor,
  ): Promise<Deal[]>;

  addItem(dealId: string, input: NewDealItem, executor?: Executor): Promise<DealItem>;

  upsertContact(
    dealId: string,
    contact: { event: ContactEvent; role: ContactRole; name: string; phone: string },
    executor?: Executor,
  ): Promise<void>;

  recordConsent(
    dealId: string,
    userId: string,
    type: ConsentType,
    stopListVersion: Date | null,
    executor?: Executor,
  ): Promise<void>;
  hasConsent(dealId: string, userId: string, type: ConsentType, executor?: Executor): Promise<boolean>;

  /** Частичное обновление условий (вес/цена) — сбрасывает оба флага согласия отдельным вызовом resetAgreement. */
  setTerms(
    dealId: string,
    input: { declaredWeightGrams?: number; priceMinor?: number },
    executor?: Executor,
  ): Promise<void>;
  markAgreed(dealId: string, role: "customer" | "courier", executor?: Executor): Promise<void>;
  resetAgreement(dealId: string, executor?: Executor): Promise<void>;

  setStatus(dealId: string, status: DealStatus, executor?: Executor): Promise<void>;
  logStatusChange(
    dealId: string,
    from: DealStatus | null,
    to: DealStatus,
    actorId: string | null,
    comment: string | null,
    executor?: Executor,
  ): Promise<void>;

  setActualWeight(dealId: string, grams: number, executor?: Executor): Promise<void>;
  setReservedWeight(dealId: string, grams: number | null, executor?: Executor): Promise<void>;

  markCourierHandedOver(dealId: string, executor?: Executor): Promise<void>;
  markCustomerHandedOverConfirmed(dealId: string, executor?: Executor): Promise<void>;

  addPhoto(dealId: string, storagePath: string, uploadedBy: string, executor?: Executor): Promise<void>;
  countPhotos(dealId: string, executor?: Executor): Promise<number>;

  setCancellation(
    dealId: string,
    reason: DealCancelReason,
    comment: string | null,
    executor?: Executor,
  ): Promise<void>;
  setNeedsReview(dealId: string, value: boolean, executor?: Executor): Promise<void>;

  setStorageUntilDate(dealId: string, date: string, executor?: Executor): Promise<void>;
  createStorageExtensionRequest(
    input: { dealId: string; requestedBy: string; requestedUntilDate: string },
    executor?: Executor,
  ): Promise<StorageExtensionRequest>;
  findStorageExtensionRequest(id: string, executor?: Executor): Promise<StorageExtensionRequest | null>;
  decideStorageExtensionRequest(
    id: string,
    status: "approved" | "rejected",
    decidedBy: string,
    executor?: Executor,
  ): Promise<StorageExtensionRequest | null>;

  // Для фоновых автопереходов (deals-cron.service.ts) — тех. детали эпика.
  findHandedOverPastDeparture(cutoffDate: string, executor?: Executor): Promise<Deal[]>;
  findInTransitPastArrival(cutoffDate: string, executor?: Executor): Promise<Deal[]>;
  findDeliveredBefore(cutoff: Date, executor?: Executor): Promise<Deal[]>;
  findAwaitingPickupPastStorage(cutoffDate: string, executor?: Executor): Promise<Deal[]>;
  findForStorageReminder(
    kind: "3d" | "1d" | "expiry",
    targetDate: string,
    executor?: Executor,
  ): Promise<Deal[]>;
  markReminderSent(dealId: string, kind: "3d" | "1d" | "expiry", executor?: Executor): Promise<void>;
  /** Сделки, перешедшие в completed внутри окна [from, to) — для напоминаний об отзыве (E11 п.11.21). */
  findCompletedInWindow(from: Date, to: Date, executor?: Executor): Promise<Deal[]>;
  /** ТЗ E12 п.12.20 — очередь проблемных сделок, попадают туда независимо от жалоб. */
  findByStatus(status: DealStatus, executor?: Executor): Promise<Deal[]>;
}

export const DEALS_REPOSITORY = Symbol("DEALS_REPOSITORY");
