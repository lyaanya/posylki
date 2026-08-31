import type { PaginatedResponse } from "../common/pagination.js";
import type { Executor } from "../database/database.js";
import type {
  Listing,
  ListingFilter,
  ListingKind,
  ListingStatus,
  NewListing,
  UpdateListing,
} from "./listings.types.js";

export interface IListingsRepository {
  /** Только status='published' — это лента и поиск (E07 п.7.16, E08). Курсорная пагинация (ТЗ п.8.4). */
  findAll(filter: ListingFilter, executor?: Executor): Promise<PaginatedResponse<Listing>>;
  findById(id: string, executor?: Executor): Promise<Listing | null>;
  /** Все статусы — владелец должен видеть и управлять скрытыми/архивными. */
  findByOwner(ownerId: string, executor?: Executor): Promise<Listing[]>;
  countActiveByOwnerAndType(
    ownerId: string,
    type: ListingKind,
    executor?: Executor,
  ): Promise<number>;
  create(input: NewListing, executor?: Executor): Promise<Listing>;
  update(id: string, input: UpdateListing, executor?: Executor): Promise<Listing>;
  setStatus(id: string, status: ListingStatus, executor?: Executor): Promise<Listing>;
  /** Для фоновой архивации (ТЗ п.7.17): рейс — после date_from, заявка — после date_to. */
  findExpiredPublishedIds(asOfDate: string, executor?: Executor): Promise<string[]>;
  /** Счётчик спроса на маршруте — активные заявки (ТЗ п.8.15.1). */
  countActiveRequestsOnRoute(fromCityId: string, toCityId: string, executor?: Executor): Promise<number>;
  /** Соседние даты в пределах ±7 дней, где на маршруте что-то есть (ТЗ п.8.15.2). */
  findNearbyDates(
    params: { type: ListingKind; fromCityId: string; toCityId: string; aroundDate: string },
    executor?: Executor,
  ): Promise<string[]>;
  /**
   * ТЗ п.10.8 — резервирует вес транзакционно: строка блокируется (FOR
   * UPDATE), поэтому две одновременные сделки не могут занять один и тот
   * же остаток. Вызывающий обязан выполнять это внутри runInTransaction.
   * Возвращает false, если свободного веса не хватает — вызывающий сам
   * решает, что делать (обычно — отказ с понятной ошибкой).
   */
  reserveWeight(listingId: string, grams: number, executor: Executor): Promise<boolean>;
  /** ТЗ п.10.18 — возврат освободившегося веса (полностью или частично) обратно в рейс. */
  releaseWeight(listingId: string, grams: number, executor?: Executor): Promise<void>;
}

export const LISTINGS_REPOSITORY = Symbol("LISTINGS_REPOSITORY");
