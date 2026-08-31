import type { ColumnType, Generated } from "kysely";
import type { ListingKind } from "../listings/listings.types.js";

export const MAX_SUBSCRIPTIONS_PER_USER = 10;

export interface RouteSubscriptionsTable {
  id: Generated<string>;
  user_id: string;
  from_city_id: string;
  to_city_id: string;
  date_from: ColumnType<Date | null, string | null, string | null>;
  date_to: ColumnType<Date | null, string | null, string | null>;
  listing_type: ListingKind | null;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface SubscriptionMatchesTable {
  id: Generated<string>;
  subscription_id: string;
  listing_id: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface RouteSubscription {
  id: string;
  fromCityId: string;
  fromCity: string;
  toCityId: string;
  toCity: string;
  dateFrom: string | null;
  dateTo: string | null;
  listingType: ListingKind | null;
  isActive: boolean;
  /** Число совпадений, накопленных с момента создания (ТЗ п.8.13). */
  matchCount: number;
  createdAt: Date;
}

export interface NewRouteSubscription {
  userId: string;
  fromCityId: string;
  toCityId: string;
  dateFrom: string | null;
  dateTo: string | null;
  listingType: ListingKind | null;
}

/** Минимум полей объявления, нужный для проверки совпадения с подпиской. */
export interface ListingMatchCandidate {
  id: string;
  type: ListingKind;
  fromCityId: string;
  toCityId: string;
  dateFrom: string;
  dateTo: string;
}
