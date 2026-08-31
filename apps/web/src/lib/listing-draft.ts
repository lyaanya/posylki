import type { ListingType } from "./listings";
import type { ParsedListingText } from "./ai";

const DRAFT_KEY = "vezzy-listing-draft";
const PUBLISHED_KEY = "vezzy-listing-published";

/**
 * Черновик до подтверждения человеком (E13 п. 13.26). ИИ-разбор определяет
 * только часть полей (type/fromCity/toCity/date/weightKg/pricePerKg/minPrice)
 * — date подставляется в dateFrom, dateTo остаётся пустым и подсвечивается,
 * как и остальное, чего ИИ не определил. Ручной мастер сразу пишет все поля.
 */
export interface ListingDraftInput {
  type?: ListingType | null;
  fromCity?: string | null;
  toCity?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  weightKg?: number | null;
  currencyCode?: string | null;
  pricePerKg?: number | null;
  minPrice?: number | null;
  priceTotal?: number | null;
  pickupInstructions?: string | null;
  dropoffInstructions?: string | null;
  storageUntilDate?: string | null;
  departureAirport?: string | null;
  arrivalAirport?: string | null;
  flightNumber?: string | null;
  itemDescription?: string | null;
  comment?: string | null;
}

/** Преобразует результат ИИ-разбора (lib/ai.ts) в черновик — date → dateFrom. */
export function draftFromParsedText(parsed: ParsedListingText): ListingDraftInput {
  return {
    type: parsed.type,
    fromCity: parsed.fromCity,
    toCity: parsed.toCity,
    dateFrom: parsed.date,
    dateTo: null,
    weightKg: parsed.weightKg,
    pricePerKg: parsed.pricePerKg,
    minPrice: parsed.minPrice,
  };
}

/** Передаёт черновик (от ИИ-разбора или из ручного мастера) на страницу черновика. */
export function saveListingDraft(data: ListingDraftInput): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export function loadListingDraft(): ListingDraftInput | null {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ListingDraftInput;
  } catch {
    return null;
  }
}

/**
 * Только id — страница «опубликовано» дальше читает реальный объект через
 * fetchListing(id), а не хранит копию его полей второй раз в sessionStorage.
 */
export function savePublishedListingId(id: string): void {
  sessionStorage.setItem(PUBLISHED_KEY, id);
}

export function loadPublishedListingId(): string | null {
  return sessionStorage.getItem(PUBLISHED_KEY);
}
