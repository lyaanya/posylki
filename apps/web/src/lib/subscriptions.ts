import { createSupabaseBrowserClient } from "./supabase-client";
import type { ListingType } from "./listings";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Формы совпадают с camelCase-ответом /subscriptions (apps/api/src/subscriptions). */
export interface RouteSubscription {
  id: string;
  fromCityId: string;
  fromCity: string;
  toCityId: string;
  toCity: string;
  dateFrom: string | null;
  dateTo: string | null;
  listingType: ListingType | null;
  isActive: boolean;
  matchCount: number;
}

export interface CreateSubscriptionInput {
  fromCityId: string;
  toCityId: string;
  dateFrom?: string;
  dateTo?: string;
  listingType?: ListingType;
}

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

export async function fetchMySubscriptions(): Promise<RouteSubscription[]> {
  const response = await fetch(`${API_URL}/subscriptions/mine`, { headers: await authHeader() });
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as RouteSubscription[];
}

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<RouteSubscription> {
  const response = await fetch(`${API_URL}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`API /subscriptions ответил ${response.status}`);
  }
  return (await response.json()) as RouteSubscription;
}

export async function setSubscriptionActive(
  id: string,
  isActive: boolean,
): Promise<RouteSubscription> {
  const response = await fetch(`${API_URL}/subscriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ isActive }),
  });
  if (!response.ok) {
    throw new Error(`API /subscriptions/${id} ответил ${response.status}`);
  }
  return (await response.json()) as RouteSubscription;
}

export async function deleteSubscription(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/subscriptions/${id}`, {
    method: "DELETE",
    headers: await authHeader(),
  });
  if (!response.ok) {
    throw new Error(`API /subscriptions/${id} ответил ${response.status}`);
  }
}
