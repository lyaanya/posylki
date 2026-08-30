import type { ColumnType, Generated } from "kysely";

export type ListingKind = "trip" | "request";

export interface ListingsTable {
  id: Generated<string>;
  owner_id: string;
  type: ListingKind;
  from_city_id: string;
  to_city_id: string;
  travel_date: ColumnType<Date, string, string>;
  free_weight_kg: ColumnType<number, number, number>;
  price_per_kg: ColumnType<number, number, number>;
  min_price: ColumnType<number, number, number>;
  description: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface Courier {
  id: string;
  name: string;
  initials: string;
  verified: boolean;
  /** Рейтинг и число сделок — заглушки до E11 (отзывы ещё не реализованы). */
  rating: number;
  dealsCount: number;
}

export interface Listing {
  id: string;
  type: ListingKind;
  fromCity: string;
  toCity: string;
  date: string;
  freeWeightKg: number;
  pricePerKg: number;
  minPrice: number;
  currency: string;
  description: string;
  createdAt: Date;
  courier: Courier;
}

export interface NewListing {
  ownerId: string;
  type: ListingKind;
  fromCityId: string;
  toCityId: string;
  date: string;
  freeWeightKg: number;
  pricePerKg: number;
  minPrice: number;
  description: string;
}

export interface ListingFilter {
  type?: ListingKind | undefined;
  fromCityId?: string | undefined;
  toCityId?: string | undefined;
}
