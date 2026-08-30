import { apiGet } from "./api";
import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Формы совпадают с camelCase-ответом /listings (apps/api/src/listings). */
export type ListingType = "trip" | "request";

export interface Courier {
  id: string;
  name: string;
  initials: string;
  verified: boolean;
  /** До E11 (отзывы) всегда 0 — рейтинг взять неоткуда. */
  rating: number;
  dealsCount: number;
}

export interface Listing {
  id: string;
  type: ListingType;
  fromCity: string;
  toCity: string;
  date: string;
  freeWeightKg: number;
  pricePerKg: number;
  minPrice: number;
  currency: string;
  description: string;
  courier: Courier;
}

export interface ListingFilter {
  type?: ListingType;
  fromCityId?: string;
  toCityId?: string;
}

function buildQuery(filter: ListingFilter): string {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.fromCityId) params.set("fromCityId", filter.fromCityId);
  if (filter.toCityId) params.set("toCityId", filter.toCityId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchListings(filter: ListingFilter = {}): Promise<Listing[]> {
  return apiGet<Listing[]>(`/listings${buildQuery(filter)}`);
}

export function fetchListing(id: string): Promise<Listing | null> {
  return apiGet<Listing>(`/listings/${id}`).catch(() => null);
}

export interface CreateListingInput {
  type: ListingType;
  fromCityId: string;
  toCityId: string;
  date: string;
  freeWeightKg: number;
  pricePerKg: number;
  minPrice: number;
  description: string;
}

/** Требует вход — та же сессия Supabase Auth, что и для ИИ-разбора (lib/ai.ts). */
export async function createListing(input: CreateListingInput): Promise<Listing> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Нужно войти в аккаунт");
  }

  const response = await fetch(`${API_URL}/listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`API /listings ответил ${response.status}`);
  }

  return (await response.json()) as Listing;
}

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
