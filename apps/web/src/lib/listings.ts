import { apiGet } from "./api";
import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Формы совпадают с camelCase-ответом /listings (apps/api/src/listings). */
export type ListingType = "trip" | "request";
export type ListingStatus =
  | "draft"
  | "on_moderation"
  | "published"
  | "hidden_by_author"
  | "archived"
  | "removed_by_moderator";

export interface Courier {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  verified: boolean;
  /** До E11 (отзывы) всегда 0 — рейтинг взять неоткуда. */
  rating: number;
  dealsCount: number;
}

export interface Listing {
  id: string;
  type: ListingType;
  status: ListingStatus;
  fromCityId: string;
  fromCity: string;
  toCityId: string;
  toCity: string;
  /** Рейс: вылет/прилёт. Заявка: желаемый диапазон "с"/"по". */
  dateFrom: string;
  dateTo: string;
  weightKg: number;
  currency: string;
  currencyCode: string;
  pricePerKg: number | null;
  minPrice: number | null;
  priceTotal: number | null;
  pickupInstructions: string | null;
  dropoffInstructions: string | null;
  storageUntilDate: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  flightNumber: string | null;
  itemDescription: string | null;
  comment: string | null;
  courier: Courier;
}

export type ListingSort = "date" | "price" | "rating";

export interface ListingFilter {
  type?: ListingType | undefined;
  fromCityId?: string | undefined;
  toCityId?: string | undefined;
  /** Активные объявления пользователя на его публичном профиле (E06 п. 6.1). */
  ownerId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  weightMinKg?: number | undefined;
  /** Требует currencyCode — сравнение цены имеет смысл только внутри одной валюты (ТЗ п.8.7). */
  priceMaxPerKg?: number | undefined;
  currencyCode?: string | undefined;
  verifiedOnly?: boolean | undefined;
  sortBy?: ListingSort | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

/** Формат ответа /listings (E01 п. 1.20) — items и next_cursor. */
export interface ListingsPage {
  items: Listing[];
  nextCursor: string | null;
}

function buildQuery(filter: ListingFilter): string {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.fromCityId) params.set("fromCityId", filter.fromCityId);
  if (filter.toCityId) params.set("toCityId", filter.toCityId);
  if (filter.ownerId) params.set("ownerId", filter.ownerId);
  if (filter.dateFrom) params.set("dateFrom", filter.dateFrom);
  if (filter.dateTo) params.set("dateTo", filter.dateTo);
  if (filter.weightMinKg !== undefined) params.set("weightMinKg", String(filter.weightMinKg));
  if (filter.priceMaxPerKg !== undefined) params.set("priceMaxPerKg", String(filter.priceMaxPerKg));
  if (filter.currencyCode) params.set("currencyCode", filter.currencyCode);
  if (filter.verifiedOnly) params.set("verifiedOnly", "true");
  if (filter.sortBy) params.set("sortBy", filter.sortBy);
  if (filter.cursor) params.set("cursor", filter.cursor);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchListingsPage(filter: ListingFilter = {}): Promise<ListingsPage> {
  const response = await apiGet<{ items: Listing[]; next_cursor: string | null }>(
    `/listings${buildQuery(filter)}`,
  );
  return { items: response.items, nextCursor: response.next_cursor };
}

/** Первая страница как плоский массив — публичный профиль и другие места без пагинации. */
export async function fetchListings(filter: ListingFilter = {}): Promise<Listing[]> {
  const page = await fetchListingsPage(filter);
  return page.items;
}

export function fetchDemandCount(fromCityId: string, toCityId: string): Promise<number> {
  return apiGet<{ count: number }>(
    `/listings/demand-count?fromCityId=${fromCityId}&toCityId=${toCityId}`,
  ).then((r) => r.count);
}

export function fetchNearbyDates(params: {
  type: ListingType;
  fromCityId: string;
  toCityId: string;
  date: string;
}): Promise<string[]> {
  const qs = new URLSearchParams(params).toString();
  return apiGet<{ dates: string[] }>(`/listings/nearby-dates?${qs}`).then((r) => r.dates);
}

export function fetchListing(id: string): Promise<Listing | null> {
  return apiGet<Listing>(`/listings/${id}`).catch(() => null);
}

export interface CreateListingInput {
  type: ListingType;
  fromCityId: string;
  toCityId: string;
  currencyId: string;
  dateFrom: string;
  dateTo: string;
  weightKg: number;
  pricePerKg?: number;
  minPrice?: number;
  priceTotal?: number;
  pickupInstructions?: string;
  dropoffInstructions?: string;
  storageUntilDate?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  flightNumber?: string;
  itemDescription?: string;
  comment?: string;
}

export type UpdateListingInput = Partial<Omit<CreateListingInput, "type">>;

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Нужно войти в аккаунт");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

export class ListingApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function parseErrorOrThrow(response: Response): Promise<never> {
  // Формат ошибок API — { error: { code, message, details } } (all-exceptions.filter.ts).
  // Важно для E13 п.13.12: при отклонении объявления модерацией message —
  // уже готовый шаблонный текст с сервера, а не generic-сообщение.
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  throw new ListingApiError(
    body?.error?.code ?? "UNKNOWN",
    body?.error?.message ?? `API ответил ${response.status}`,
  );
}

/** Требует вход — та же сессия Supabase Auth, что и для ИИ-разбора (lib/ai.ts). */
export async function createListing(input: CreateListingInput): Promise<Listing> {
  const response = await fetch(`${API_URL}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });

  if (!response.ok) await parseErrorOrThrow(response);

  return (await response.json()) as Listing;
}

export async function updateListing(id: string, input: UpdateListingInput): Promise<Listing> {
  const response = await fetch(`${API_URL}/listings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`API /listings/${id} ответил ${response.status}`);
  }

  return (await response.json()) as Listing;
}

async function setListingVisibility(id: string, action: "hide" | "unhide"): Promise<Listing> {
  const response = await fetch(`${API_URL}/listings/${id}/${action}`, {
    method: "POST",
    headers: await authHeader(),
  });

  if (!response.ok) {
    throw new Error(`API /listings/${id}/${action} ответил ${response.status}`);
  }

  return (await response.json()) as Listing;
}

/** ТЗ п.7.18 — автор скрывает/возвращает объявление в любой момент. */
export const hideListing = (id: string) => setListingVisibility(id, "hide");
export const unhideListing = (id: string) => setListingVisibility(id, "unhide");

export async function fetchMyListings(): Promise<Listing[]> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return [];
  }

  const response = await fetch(`${API_URL}/listings/mine`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as Listing[];
}
