import type { ListingType } from "./listings";
import type { ParsedListingText } from "./ai";

const DRAFT_KEY = "vezzy-listing-draft";
const PUBLISHED_KEY = "vezzy-listing-published";

/**
 * Передаёт результат разбора текста (E13, сценарий 3) со страницы создания
 * объявления на страницу черновика. Только sessionStorage — реального
 * сохранения объявлений ещё нет (бэкенд E07 не реализован), это визуальная
 * демонстрация разбора текста, не публикация.
 */
export function saveListingDraft(data: ParsedListingText): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export function loadListingDraft(): ParsedListingText | null {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ParsedListingText;
  } catch {
    return null;
  }
}

export interface ListingDraftFields {
  type: ListingType;
  fromCity: string;
  toCity: string;
  date: string;
  weightKg: string;
  pricePerKg: string;
  minPrice: string;
  description: string;
}

/** Финальные поля черновика — со страницы черновика на страницу «опубликовано». */
export function savePublishedListing(data: ListingDraftFields): void {
  sessionStorage.setItem(PUBLISHED_KEY, JSON.stringify(data));
}

export function loadPublishedListing(): ListingDraftFields | null {
  const raw = sessionStorage.getItem(PUBLISHED_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ListingDraftFields;
  } catch {
    return null;
  }
}
