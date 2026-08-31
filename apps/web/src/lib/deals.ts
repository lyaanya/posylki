import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Формы совпадают с camelCase-ответом /deals (apps/api/src/deals). */
export type DealStatus =
  | "responded"
  | "agreed"
  | "handed_over"
  | "in_transit"
  | "awaiting_pickup"
  | "delivered"
  | "completed"
  | "cancelled"
  | "problem";

export type DealCancelReason =
  | "changed_mind"
  | "terms_not_agreed"
  | "schedule_changed"
  | "found_another"
  | "other";

export type ContactEvent = "handover" | "pickup";
export type ContactRole = "customer" | "courier";
export type ConsentType = "stop_list" | "item_warning";
export type StorageExtensionStatus = "pending" | "approved" | "rejected";

export interface DealParticipant {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export interface DealItem {
  id: string;
  name: string;
  quantity: number;
  weightGrams: number | null;
  warningText: string | null;
  aiCheckFailed: boolean;
  createdAt: string;
}

export interface DealPhoto {
  id: string;
  url: string;
  uploadedBy: string;
  createdAt: string;
}

export interface DealContact {
  event: ContactEvent;
  role: ContactRole;
  name: string;
  phone: string;
}

export interface DealStatusLogEntry {
  id: string;
  fromStatus: DealStatus | null;
  toStatus: DealStatus;
  actorId: string | null;
  comment: string | null;
  createdAt: string;
}

export interface DealConsent {
  userId: string;
  consentType: ConsentType;
  consentedAt: string;
}

export interface StorageExtensionRequest {
  id: string;
  requestedBy: string;
  requestedUntilDate: string;
  status: StorageExtensionStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface Deal {
  id: string;
  chatId: string;
  listingId: string;
  dealType: "delivery";
  status: DealStatus;
  customer: DealParticipant;
  courier: DealParticipant;
  fromCityId: string;
  fromCity: string;
  toCityId: string;
  toCity: string;
  dateFrom: string;
  dateTo: string;
  declaredWeightGrams: number | null;
  actualWeightGrams: number | null;
  payableWeightGrams: number | null;
  reservedWeightGrams: number | null;
  priceMinor: number | null;
  currencyCode: string;
  currencySymbol: string;
  storageUntilDate: string | null;
  customerAgreedAt: string | null;
  courierAgreedAt: string | null;
  courierHandedOverAt: string | null;
  customerHandedOverConfirmedAt: string | null;
  cancelReason: DealCancelReason | null;
  cancelComment: string | null;
  needsReview: boolean;
  items: DealItem[];
  photos: DealPhoto[];
  contacts: DealContact[];
  consents: DealConsent[];
  storageExtensionRequests: StorageExtensionRequest[];
  statusLog: DealStatusLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export class DealApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
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

async function parseErrorOrThrow(response: Response): Promise<never> {
  // Формат ошибок API — { error: { code, message, details } } (all-exceptions.filter.ts).
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  throw new DealApiError(
    body?.error?.code ?? "UNKNOWN",
    body?.error?.message ?? `API ответил ${response.status}`,
  );
}

async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(await authHeader()), ...init?.headers },
  });
  if (!response.ok) await parseErrorOrThrow(response);
  return (await response.json()) as T;
}

export function fetchMyDeals(): Promise<Deal[]> {
  return apiCall<Deal[]>("/deals/mine");
}

export function fetchDeal(id: string): Promise<Deal> {
  return apiCall<Deal>(`/deals/${id}`);
}

export function fetchDealsByChat(chatId: string): Promise<Deal[]> {
  return apiCall<Deal[]>(`/deals/by-chat/${chatId}`);
}

export function createDeal(chatId: string): Promise<Deal> {
  return apiCall<Deal>("/deals", { method: "POST", body: JSON.stringify({ chatId }) });
}

export function addDealItem(
  dealId: string,
  input: { name: string; quantity?: number | undefined; weightKg?: number | undefined },
): Promise<DealItem> {
  return apiCall<DealItem>(`/deals/${dealId}/items`, { method: "POST", body: JSON.stringify(input) });
}

export function setDealTerms(
  dealId: string,
  input: { declaredWeightKg?: number | undefined; price?: number | undefined },
): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/terms`, { method: "PATCH", body: JSON.stringify(input) });
}

export function recordDealConsent(dealId: string, type: ConsentType): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/consents`, { method: "POST", body: JSON.stringify({ type }) });
}

export function confirmDealTerms(dealId: string): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/confirm-terms`, { method: "POST" });
}

export function setDealContact(dealId: string, contact: DealContact): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/contacts`, { method: "PATCH", body: JSON.stringify(contact) });
}

export async function uploadDealPhoto(dealId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/deals/${dealId}/photos`, {
    method: "POST",
    headers: await authHeader(),
    body: formData,
  });
  if (!response.ok) await parseErrorOrThrow(response);
  const data = (await response.json()) as { path: string };
  return data.path;
}

export function handoverDeal(
  dealId: string,
  input: { actualWeightKg?: number | undefined; photoStoragePaths: string[] },
): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/handover`, { method: "POST", body: JSON.stringify(input) });
}

export function confirmHandover(dealId: string): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/confirm-handover`, { method: "POST" });
}

export function departDeal(dealId: string): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/depart`, { method: "POST" });
}

export function arriveDeal(dealId: string): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/arrive`, { method: "POST" });
}

export function deliverDeal(dealId: string): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/deliver`, { method: "POST" });
}

export function completeDeal(dealId: string): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/complete`, { method: "POST" });
}

export function cancelDeal(
  dealId: string,
  input: { reason: DealCancelReason; comment?: string | undefined },
): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/cancel`, { method: "POST", body: JSON.stringify(input) });
}

export function requestStorageExtension(dealId: string, requestedUntilDate: string): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/storage-extension`, {
    method: "POST",
    body: JSON.stringify({ requestedUntilDate }),
  });
}

export function decideStorageExtension(
  dealId: string,
  requestId: string,
  decision: "approve" | "reject",
): Promise<Deal> {
  return apiCall<Deal>(`/deals/${dealId}/storage-extension/${requestId}/${decision}`, { method: "POST" });
}
