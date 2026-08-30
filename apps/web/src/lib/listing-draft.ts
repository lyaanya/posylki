import type { ListingType } from "./listings";
import type { ParsedListingText } from "./ai";

const DRAFT_KEY = "vezzy-listing-draft";
const PUBLISHED_KEY = "vezzy-listing-published";

/**
 * Черновик до подтверждения человеком (E13 п. 13.26) — либо от ИИ-разбора
 * (числовые поля, без описания), либо из ручного мастера (строки, как
 * вводит пользователь, уже с описанием). Страница черновика приводит оба
 * варианта к одному виду.
 */
export type ListingDraftInput = Partial<ParsedListingText> & { description?: string | null };

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

export interface ListingDraftFields {
  id?: string;
  type: ListingType;
  fromCity: string;
  toCity: string;
  date: string;
  weightKg: string;
  pricePerKg: string;
  minPrice: string;
  description: string;
}

/** Финальные поля опубликованного объявления — со страницы черновика на страницу «опубликовано». */
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
