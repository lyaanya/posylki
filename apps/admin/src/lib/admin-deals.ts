import { apiGet, apiPost } from "./api";

export interface AdminDeal {
  id: string;
  chatId: string;
  status: string;
  customer: { id: string; name: string };
  courier: { id: string; name: string };
  fromCity: string;
  toCity: string;
  declaredWeightGrams: number | null;
  actualWeightGrams: number | null;
  payableWeightGrams: number | null;
  priceMinor: number | null;
  currencySymbol: string;
  contacts: unknown[];
  photos: unknown[];
  items: unknown[];
  statusLog: { toStatus: string; createdAt: string; comment: string | null }[];
  createdAt: string;
}

export function fetchDeals(filters: { status?: string } = {}): Promise<AdminDeal[]> {
  const params = new URLSearchParams(filters as Record<string, string>);
  return apiGet(`/admin/deals${params.toString() ? `?${params.toString()}` : ""}`);
}

export function fetchDeal(id: string): Promise<AdminDeal> {
  return apiGet(`/admin/deals/${id}`);
}

export function resolveDeal(dealId: string, input: { action: "warn" | "ban_user" | "reject"; reason: string; userId?: string; banDurationDays?: number }) {
  return apiPost(`/admin/deals/${dealId}/resolve`, input);
}
