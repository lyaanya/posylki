import type { ColumnType, Generated } from "kysely";

export type ListingKind = "trip" | "request";

export type ListingStatus =
  | "draft"
  | "on_moderation"
  | "published"
  | "hidden_by_author"
  | "archived"
  | "removed_by_moderator";

/** Статусы, занимающие место в лимите из 10 активных объявлений (ТЗ п.7.23). */
export const ACTIVE_LISTING_STATUSES: ListingStatus[] = [
  "draft",
  "on_moderation",
  "published",
  "hidden_by_author",
];
export const MAX_ACTIVE_LISTINGS_PER_TYPE = 10;

export interface ListingsTable {
  id: Generated<string>;
  owner_id: string;
  type: ListingKind;
  status: Generated<ListingStatus>;
  from_city_id: string;
  to_city_id: string;
  currency_id: string;
  date_from: ColumnType<Date, string, string>;
  date_to: ColumnType<Date, string, string>;
  weight_grams: number;
  price_per_kg_minor: number | null;
  min_price_minor: number | null;
  price_total_minor: number | null;
  pickup_instructions: string | null;
  dropoff_instructions: string | null;
  storage_until_date: ColumnType<Date | null, string | null, string | null>;
  departure_airport: string | null;
  arrival_airport: string | null;
  flight_number: string | null;
  item_description: string | null;
  comment: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface Courier {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  verified: boolean;
  /** Рейтинг и число сделок — заглушки до E11 (отзывы ещё не реализованы). */
  rating: number;
  dealsCount: number;
}

export interface Listing {
  id: string;
  type: ListingKind;
  status: ListingStatus;
  fromCityId: string;
  fromCity: string;
  toCityId: string;
  toCity: string;
  /** Рейс: вылет/прилёт. Заявка: желаемый диапазон "с"/"по". */
  dateFrom: string;
  dateTo: string;
  weightKg: number;
  /** Символ валюты (например "₽"), не код — так исторически ждёт веб. */
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
  createdAt: Date;
  courier: Courier;
}

export interface NewListing {
  ownerId: string;
  type: ListingKind;
  fromCityId: string;
  toCityId: string;
  currencyId: string;
  dateFrom: string;
  dateTo: string;
  weightGrams: number;
  pricePerKgMinor: number | null;
  minPriceMinor: number | null;
  priceTotalMinor: number | null;
  pickupInstructions: string | null;
  dropoffInstructions: string | null;
  storageUntilDate: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  flightNumber: string | null;
  itemDescription: string | null;
  comment: string | null;
}

export type UpdateListing = Partial<Omit<NewListing, "ownerId" | "type">>;

export type ListingSort = "date" | "price" | "rating";

export interface ListingFilter {
  type?: ListingKind | undefined;
  fromCityId?: string | undefined;
  toCityId?: string | undefined;
  ownerId?: string | undefined;
  /** Пересечение диапазона [dateFrom, dateTo] с датами объявления (ТЗ п.8.5). */
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  weightMinGrams?: number | undefined;
  /** В минорных единицах — контроллер уже перевёл major→minor по currencyCode. */
  priceMaxPerKgMinor?: number | undefined;
  currencyCode?: string | undefined;
  verifiedOnly?: boolean | undefined;
  /**
   * "rating" — до E11 (отзывы) реального столбца рейтинга нет, сортировка
   * молча ведёт себя как "date" (порядок стабилен, просто не по рейтингу).
   */
  sortBy?: ListingSort | undefined;
  cursor?: { sortValue: string; id: string } | undefined;
  limit: number;
}
