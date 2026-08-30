import { apiGet } from "./api";

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
